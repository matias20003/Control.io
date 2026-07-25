"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, Plus, Minus, X, Music, Volume2, VolumeX,
  CheckCircle2, Loader2, BrainCircuit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { closeSessionAction, addFocusNoteAction } from "@/app/actions/study-system";
import type { PlanItem, BlockDTO } from "@/lib/db/study-system";

// Música de enfoque CURADA: solo instrumental / sin voz, pensada para concentrar.
// TODOS son videos permanentes (NO en vivo) de 1-10h → no dependen de un stream
// y no cortan en una sesión. No se puede elegir otra cosa.
const TRACKS = [
  { id: "AznRJvAPtwM", label: "Lofi estudio", tag: "beats para concentrar" },
  { id: "vWjl07A3rZg", label: "Lofi relax", tag: "beats suaves" },
  { id: "oiGmGFxsJi8", label: "Piano", tag: "piano tranquilo" },
  { id: "8WVXk0Gz66E", label: "Piano · guitarra", tag: "calma (10 h)" },
];

const MASTERY = [
  { k: "ROJO", label: "Rojo", hint: "estudiado, no entendido", dot: "bg-red-500", ring: "ring-red-500/50", text: "text-red-500" },
  { k: "AMARILLO", label: "Amarillo", hint: "entendido con ayuda", dot: "bg-amber-500", ring: "ring-amber-500/50", text: "text-amber-500" },
  { k: "VERDE", label: "Verde", hint: "resuelto sin ayuda", dot: "bg-emerald-500", ring: "ring-emerald-500/50", text: "text-emerald-500" },
  { k: "CONSOLIDADO", label: "Consolidado", hint: "resuelto en repasos separados", dot: "bg-sky-500", ring: "ring-sky-500/50", text: "text-sky-500" },
];

function fmt(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** Tono suave con Web Audio (sin assets) para avisar que terminó el bloque. */
function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1174].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.28;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.start(t); o.stop(t + 0.55);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch { /* sin audio, no pasa nada */ }
}

export function FocusMode({
  block, onClose, onDone,
}: {
  block: PlanItem | BlockDTO;
  onClose: () => void;
  onDone: (b: BlockDTO) => void;
}) {
  const initialSec = Math.max(60, (block.reviewDuration || 25) * 60);
  const [totalSec, setTotalSec] = useState(initialSec);
  const [leftSec, setLeftSec] = useState(initialSec);
  const [running, setRunning] = useState(false);
  const [focusedSec, setFocusedSec] = useState(0);
  const [draft, setDraft] = useState("");
  const [sessionNotes, setSessionNotes] = useState<{ id: string; text: string }[]>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [showNotes, setShowNotes] = useState(false); // notas ocultas por defecto: son opcionales
  const [track, setTrack] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<"focus" | "finish">("focus");
  const [result, setResult] = useState("");
  const [isPending, start] = useTransition();
  const doneRef = useRef(false);

  // Guarda UNA nota (Enter): se persiste vinculada al bloque y entra a la caja.
  const saveQuickNote = async () => {
    const t = draft.trim();
    if (!t || savingNote) return;
    setSavingNote(true);
    const res = await addFocusNoteAction({ subjectCode: block.subjectCode, blockCode: block.code, topic: block.topic, text: t }).catch(() => ({ error: "error" as const }));
    setSavingNote(false);
    if ("error" in res && res.error) { toast.error(res.error); return; }
    const id = "id" in res && res.id ? res.id : `tmp-${Date.now()}`;
    setSessionNotes((prev) => [{ id, text: t }, ...prev]);
    setDraft("");
  };
  const closeAll = () => { if (draft.trim()) void saveQuickNote(); onClose(); };

  // Reloj: descuenta mientras corre y acumula el tiempo enfocado real.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setFocusedSec((s) => s + 1);
      setLeftSec((s) => {
        if (s <= 1) {
          setRunning(false);
          if (!doneRef.current) { doneRef.current = true; chime(); }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  const adjust = (deltaMin: number) => {
    const d = deltaMin * 60;
    setTotalSec((t) => Math.max(60, t + d));
    setLeftSec((s) => Math.max(0, s + d));
    doneRef.current = false;
  };
  const reset = () => { setRunning(false); setLeftSec(totalSec); doneRef.current = false; };

  const finish = () => {
    if (!result) { toast.error("Elegí cómo te fue para cerrar"); return; }
    if (draft.trim()) void saveQuickNote(); // no perder lo que quedó tipeado
    const sessionSummary = sessionNotes.map((n) => n.text).reverse().join("\n");
    start(async () => {
      const res = await closeSessionAction({
        blockId: block.id,
        result,
        actualDuration: Math.max(1, Math.round(focusedSec / 60)),
        notes: sessionSummary || undefined,
      });
      if (res.error) { toast.error(res.error); return; }
      if (res.success && res.block) {
        onDone(res.block);
        toast.success(`Sesión cerrada · ${Math.round(focusedSec / 60)} min enfocado`);
        onClose();
      }
    });
  };

  // Progreso del anillo (queda del tiempo).
  const R = 130;
  const C = 2 * Math.PI * R;
  const progress = totalSec ? leftSec / totalSec : 0;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
      {/* halo ambiental */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary-dim),transparent_60%)]" />

      <div className="relative mx-auto max-w-5xl px-4 py-5">
        {/* Barra superior */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
              {block.subjectCode} · {block.code}
            </p>
            <h1 className="mt-0.5 text-lg font-bold text-foreground leading-tight">{block.topic}</h1>
          </div>
          <button onClick={closeAll} className="rounded-xl border border-border p-2 text-muted hover:text-foreground" title="Salir (guarda tus notas)">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* ── Cronómetro ── */}
          <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-surface/40 py-10">
            <div className="relative grid place-items-center">
              <svg width="300" height="300" viewBox="0 0 300 300" className="-rotate-90">
                <circle cx="150" cy="150" r={R} fill="none" stroke="var(--color-surface-2)" strokeWidth="10" />
                <circle
                  cx="150" cy="150" r={R} fill="none"
                  stroke="var(--color-primary)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="font-mono text-6xl font-bold tabular-nums text-foreground">{fmt(leftSec)}</span>
                <span className="mt-1 text-xs text-muted">
                  {leftSec === 0 ? "¡tiempo!" : running ? "enfocado" : "en pausa"} · {Math.round(focusedSec / 60)} min hechos
                </span>
              </div>
            </div>

            {/* Controles */}
            <div className="mt-8 flex items-center gap-3">
              <button onClick={() => adjust(-5)} className="grid h-11 w-11 place-items-center rounded-full border border-border text-muted hover:text-foreground" aria-label="-5 min"><Minus size={18} /></button>
              <button
                onClick={() => setRunning((r) => !r)}
                className="grid h-16 w-16 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition-transform active:scale-95"
                aria-label={running ? "Pausar" : "Empezar"}
              >
                {running ? <Pause size={26} /> : <Play size={26} className="ml-0.5" />}
              </button>
              <button onClick={() => adjust(5)} className="grid h-11 w-11 place-items-center rounded-full border border-border text-muted hover:text-foreground" aria-label="+5 min"><Plus size={18} /></button>
            </div>
            <button onClick={reset} className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground">
              <RotateCcw size={13} /> Reiniciar
            </button>
          </div>

          {/* ── Panel derecho: notas + música ── */}
          <div className="space-y-4">
            {/* Notas rápidas (OPCIONAL, ocultas por defecto): escribís y Enter guarda */}
            {!showNotes ? (
              <button
                onClick={() => setShowNotes(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border px-4 py-2.5 text-xs font-medium text-muted hover:text-foreground hover:border-primary/50"
              >
                <BrainCircuit size={14} /> Vaciar la cabeza (opcional)
              </button>
            ) : (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <BrainCircuit size={14} className="text-primary" /> Vaciá la cabeza
                </p>
                <button onClick={() => setShowNotes(false)} className="text-[11px] text-muted hover:text-foreground">Ocultar</button>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveQuickNote(); }
                }}
                placeholder="Escribí una nota y tocá Enter para guardarla y sacarla de la cabeza…"
                rows={3}
                className="w-full resize-y rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
              />
              <p className="mt-1.5 text-[11px] text-muted">
                <b>Enter</b> guarda la nota (Shift+Enter = salto de línea). Queda vinculada a <span className="text-foreground/70">{block.code}</span> y en tus Apuntes.
              </p>

              {/* Caja de notas de esta sesión */}
              {sessionNotes.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Notas guardadas · {sessionNotes.length}</p>
                  <div className="max-h-52 space-y-1.5 overflow-y-auto">
                    {sessionNotes.map((n) => (
                      <div key={n.id} className="rounded-lg border border-border bg-surface-2/30 px-2.5 py-1.5">
                        <p className="text-xs text-foreground whitespace-pre-wrap">{n.text}</p>
                        <p className="mt-0.5 text-[10px] text-muted">🔖 {block.code} · {block.subjectCode}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {savingNote && <p className="mt-1.5 flex items-center gap-1 text-[11px] text-primary"><Loader2 size={11} className="animate-spin" /> Guardando…</p>}
            </div>
            )}

            {/* Música */}
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Music size={14} className="text-primary" /> Música de enfoque
                </p>
                {track && (
                  <button onClick={() => setMuted((m) => !m)} className="text-muted hover:text-foreground" aria-label={muted ? "Reanudar" : "Silenciar"}>
                    {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {TRACKS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTrack((cur) => (cur === t.id ? null : t.id)); setMuted(false); }}
                    className={cn(
                      "rounded-xl border px-2.5 py-2 text-left transition-colors",
                      track === t.id ? "border-primary/50 bg-primary/10" : "border-border hover:bg-surface-2/50"
                    )}
                  >
                    <p className={cn("text-xs font-semibold", track === t.id ? "text-primary" : "text-foreground")}>{t.label}</p>
                    <p className="text-[10px] text-muted leading-tight">{t.tag}</p>
                  </button>
                ))}
              </div>
              {track && !muted && (
                <div className="mt-2.5 overflow-hidden rounded-lg">
                  <iframe
                    key={track}
                    title="Música de enfoque"
                    width="100%" height="80"
                    src={`https://www.youtube-nocookie.com/embed/${track}?autoplay=1`}
                    allow="autoplay; encrypted-media"
                    className="block w-full"
                  />
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-muted">Solo instrumental, sin voz — para concentrar.</p>
            </div>

            {/* Terminar */}
            {phase === "focus" ? (
              <button
                onClick={() => setPhase("finish")}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white"
              >
                Terminar sesión
              </button>
            ) : (
              <div className="rounded-2xl border border-primary/30 bg-surface p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground">¿Cómo te fue con este tema?</p>
                <div className="grid grid-cols-2 gap-2">
                  {MASTERY.map((m) => (
                    <button
                      key={m.k}
                      onClick={() => setResult(m.k)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition-all",
                        result === m.k ? cn("border-transparent bg-surface-2 ring-2", m.ring) : "border-border hover:bg-surface-2/50"
                      )}
                    >
                      <span className={cn("flex items-center gap-1.5 text-sm font-medium", result === m.k ? m.text : "text-foreground")}>
                        <span className={cn("h-2.5 w-2.5 rounded-full", m.dot)} /> {m.label}
                      </span>
                      <span className="text-[10px] text-muted">{m.hint}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={finish}
                  disabled={isPending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Cerrar y agendar próximo repaso
                </button>
                <button onClick={() => setPhase("focus")} className="w-full text-xs text-muted hover:text-foreground">
                  Volver al cronómetro
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
