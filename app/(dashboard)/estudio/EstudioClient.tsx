"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  GraduationCap, Upload, Loader2, FileText, CalendarClock, Check,
  ChevronDown, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudyNoteView, ReviewView } from "@/lib/db/study";

/** Render mínimo de markdown: **negrita** + saltos de línea. Sin HTML crudo. */
function Md({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="text-foreground">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  );
}

function relDay(iso: string): { label: string; overdue: boolean } {
  const d = new Date(iso);
  const days = Math.round((d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days < 0) return { label: `atrasado ${-days}d`, overdue: true };
  if (days === 0) return { label: "Hoy", overdue: false };
  if (days === 1) return { label: "Mañana", overdue: false };
  if (days <= 6) return { label: `en ${days} días`, overdue: false };
  return { label: new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }), overdue: false };
}

export function EstudioClient({ notes, reviews }: { notes: StudyNoteView[]; reviews: ReviewView[] }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (file?: File) => {
    if (!file && text.trim().length < 20) {
      toast.error("Subí un PDF o pegá el texto del apunte.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      if (text.trim()) fd.append("text", text.trim());
      if (subject.trim()) fd.append("subject", subject.trim());
      const res = await fetch("/api/estudio/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      toast.success(`Guardado: ${data.subject} — ${data.title}. Te agendé el repaso 📚`);
      setText(""); setSubject("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setUploading(false);
    }
  };

  const markDone = async (id: string) => {
    try {
      await fetch("/api/estudio/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewId: id }) });
      router.refresh();
    } catch { toast.error("No pude marcarlo"); }
  };

  // Apuntes agrupados por materia
  const bySubject = notes.reduce<Record<string, StudyNoteView[]>>((acc, n) => {
    (acc[n.subject] ??= []).push(n);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <GraduationCap size={20} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">Estudio</h1>
          <p className="text-xs text-muted">Subí lo del día, la IA lo resume y te agenda el repaso espaciado.</p>
        </div>
      </div>

      {/* Subir */}
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Materia (opcional — la IA la detecta sola)"
          className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground placeholder:text-muted"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pegá tu apunte o resumen del día…"
          rows={3}
          className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground placeholder:text-muted resize-y"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) submit(f); }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 disabled:opacity-50"
          >
            <FileText size={15} /> Subir PDF
          </button>
          <button
            onClick={() => submit()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading ? "Procesando…" : "Guardar y agendar repaso"}
          </button>
          <span className="text-[11px] text-muted">También podés mandarle el PDF al bot de WhatsApp.</span>
        </div>
      </div>

      {/* Próximos repasos */}
      {reviews.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted flex items-center gap-1.5">
            <CalendarClock size={13} /> Próximos repasos
          </h2>
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden">
            {reviews.slice(0, 12).map((r) => {
              const d = relDay(r.dueDate);
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn("text-[11px] font-semibold w-20 shrink-0", d.overdue ? "text-danger" : "text-primary")}>{d.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-[11px] text-muted truncate">{r.subject} · repaso #{["", "1º", "2º", "3º", "4º"][[1, 3, 7, 16].indexOf(r.interval) + 1] || ""}</p>
                  </div>
                  <button onClick={() => markDone(r.id)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-success hover:border-success/50 transition-colors shrink-0">
                    <Check size={13} /> Hecho
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Apuntes por materia */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted flex items-center gap-1.5">
          <BookOpen size={13} /> Mis apuntes
        </h2>
        {notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
            Todavía no cargaste nada. Subí un PDF o pegá tu primer apunte arriba.
          </div>
        ) : (
          Object.entries(bySubject).map(([subj, ns]) => (
            <div key={subj} className="rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-surface-2/30">
                <p className="text-sm font-semibold text-foreground">{subj} <span className="text-muted font-normal">· {ns.length}</span></p>
              </div>
              <div className="divide-y divide-border">
                {ns.map((n) => (
                  <div key={n.id}>
                    <button onClick={() => setExpanded(expanded === n.id ? null : n.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2/30 transition-colors">
                      <FileText size={15} className="text-muted shrink-0" />
                      <span className="text-sm text-foreground truncate flex-1">{n.title}</span>
                      <span className="text-[11px] text-muted shrink-0">{new Date(n.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</span>
                      <ChevronDown size={15} className={cn("text-muted shrink-0 transition-transform", expanded === n.id && "rotate-180")} />
                    </button>
                    {expanded === n.id && (
                      <div className="px-4 pb-4 pt-1"><Md text={n.summary} /></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
