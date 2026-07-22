"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock, BookOpen, Table2, Sparkles, Plus, Loader2, X,
  Clock, Target, ChevronRight, CheckCircle2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createSubjectAction, createBlockAction, closeSessionAction,
} from "@/app/actions/study-system";
import type { SubjectDTO, BlockDTO, PlanItem } from "@/lib/db/study-system";
import { EstudioClient } from "./EstudioClient";
import type { StudyNoteView, ReviewView } from "@/lib/db/study";

type Tab = "hoy" | "materias" | "tabla" | "apuntes";

const MASTERY_META: Record<string, { label: string; dot: string; text: string; ring: string }> = {
  ROJO: { label: "Rojo", dot: "bg-red-500", text: "text-red-500", ring: "ring-red-500/40" },
  AMARILLO: { label: "Amarillo", dot: "bg-amber-500", text: "text-amber-500", ring: "ring-amber-500/40" },
  VERDE: { label: "Verde", dot: "bg-emerald-500", text: "text-emerald-500", ring: "ring-emerald-500/40" },
  CONSOLIDADO: { label: "Consolidado", dot: "bg-sky-500", text: "text-sky-500", ring: "ring-sky-500/40" },
};

const STAGE_LABEL: Record<string, string> = {
  "D0": "Estudio inicial", "D+1": "Repaso 1 (D+1)", "D+3": "Repaso 2 (D+3)",
  "D+7": "Repaso 3 (D+7)", "D+16": "Repaso 4 (D+16)",
  "MANT_SEM": "Mantenimiento semanal", "MANT_QUIN": "Mantenimiento quincenal",
};

const ERROR_CATS = [
  "Conceptual", "De procedimiento", "De cálculo", "De distracción",
  "Falta de práctica", "No entendí la consigna",
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function MasteryBadge({ level }: { level: string }) {
  const m = MASTERY_META[level] ?? MASTERY_META.ROJO;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold", m.text)}>
      <span className={cn("h-2 w-2 rounded-full", m.dot)} /> {m.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Modal de cierre de sesión (Sección 11 — obligatorio elegir estado)
// ─────────────────────────────────────────────
function CloseSessionModal({
  block, onClose, onDone,
}: {
  block: PlanItem | BlockDTO;
  onClose: () => void;
  onDone: (b: BlockDTO) => void;
}) {
  const [result, setResult] = useState<string>("");
  const [duration, setDuration] = useState("");
  const [errorCat, setErrorCat] = useState("");
  const [errorDesc, setErrorDesc] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, start] = useTransition();

  const failing = result === "ROJO" || result === "AMARILLO";

  const save = () => {
    if (!result) { toast.error("Elegí cómo te fue (es obligatorio para cerrar)"); return; }
    start(async () => {
      const res = await closeSessionAction({
        blockId: block.id,
        result,
        actualDuration: duration ? Number(duration) : undefined,
        errorCategory: failing && errorCat ? errorCat : undefined,
        errorDescription: failing && errorDesc.trim() ? errorDesc.trim() : undefined,
        notes: notes.trim() || undefined,
      });
      if (res.error) { toast.error(res.error); return; }
      if (res.success && res.block) {
        onDone(res.block);
        const next = res.block.nextReviewDate ? fmtDate(res.block.nextReviewDate) : "—";
        toast.success(`Sesión cerrada. Próximo repaso: ${next} (${STAGE_LABEL[res.block.reviewStage] ?? res.block.reviewStage})`);
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-border bg-surface p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-muted">{block.code} · {block.subjectCode}</p>
            <h3 className="text-base font-bold text-foreground truncate">{block.topic}</h3>
            <p className="text-[11px] text-muted">{STAGE_LABEL[block.reviewStage] ?? block.reviewStage}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-foreground"><X size={18} /></button>
        </div>

        <div>
          <p className="text-xs font-semibold text-foreground mb-2">¿Cómo te fue? <span className="text-danger">*</span></p>
          <div className="grid grid-cols-2 gap-2">
            {["ROJO", "AMARILLO", "VERDE", "CONSOLIDADO"].map((lv) => {
              const m = MASTERY_META[lv];
              const on = result === lv;
              return (
                <button
                  key={lv}
                  onClick={() => setResult(lv)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                    on ? cn("border-transparent bg-surface-2 ring-2", m.ring, m.text) : "border-border text-muted hover:text-foreground"
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full", m.dot)} /> {m.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted mt-1.5">
            Rojo = no lo entendí · Amarillo = a medias · Verde = lo pude explicar solo · Consolidado = lo domino hace varios repasos
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Minutos reales
            <input
              type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)}
              placeholder="25"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>

        {failing && (
          <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
              <AlertCircle size={13} /> ¿Qué falló? (para no repetir el error)
            </p>
            <select
              value={errorCat} onChange={(e) => setErrorCat(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground"
            >
              <option value="">Categoría del error…</option>
              {ERROR_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              value={errorDesc} onChange={(e) => setErrorDesc(e.target.value)}
              placeholder="¿Qué te costó puntualmente?"
              className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground"
            />
          </div>
        )}

        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas de la sesión (opcional)…" rows={2}
          className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground resize-y"
        />

        <button
          onClick={save} disabled={isPending}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Cerrar sesión y agendar próximo repaso
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Nueva materia
// ─────────────────────────────────────────────
function NewSubject({ onCreated }: { onCreated: (s: SubjectDTO) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"cuatrimestral" | "anual">("cuatrimestral");
  const [isPending, start] = useTransition();

  const save = () => {
    if (!name.trim() || !code.trim()) { toast.error("Poné nombre y sigla (ej. AM2)"); return; }
    start(async () => {
      const res = await createSubjectAction({ name: name.trim(), code: code.trim(), type });
      if (res.error) { toast.error(res.error); return; }
      if (res.success && res.subject) {
        onCreated(res.subject);
        setName(""); setCode(""); setOpen(false);
        toast.success("Materia creada");
      }
    });
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:border-primary/50">
        <Plus size={15} /> Nueva materia
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej. Análisis Matemático II)" className="col-span-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground" />
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Sigla" maxLength={12} className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground" />
      </div>
      <div className="flex items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as "cuatrimestral" | "anual")} className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground">
          <option value="cuatrimestral">Cuatrimestral</option>
          <option value="anual">Anual</option>
        </select>
        <button onClick={save} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Crear
        </button>
        <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground">Cancelar</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Nuevo bloque
// ─────────────────────────────────────────────
function NewBlock({ subjects, onCreated }: { subjects: SubjectDTO[]; onCreated: (b: BlockDTO) => void }) {
  const [subjectId, setSubjectId] = useState("");
  const [parcial, setParcial] = useState("1");
  const [topic, setTopic] = useState("");
  const [unit, setUnit] = useState("");
  const [importance, setImportance] = useState("2");
  const [difficulty, setDifficulty] = useState("2");
  const [summary, setSummary] = useState("");
  const [isPending, start] = useTransition();

  const save = () => {
    if (!subjectId) { toast.error("Elegí la materia"); return; }
    if (!topic.trim()) { toast.error("Escribí el tema del bloque"); return; }
    start(async () => {
      const res = await createBlockAction({
        subjectId, parcial: Number(parcial), topic: topic.trim(),
        unit: unit.trim() || undefined, importance: Number(importance), difficulty: Number(difficulty),
        summary: summary.trim() || undefined,
      });
      if (res.error) { toast.error(res.error); return; }
      if (res.success && res.block) {
        onCreated(res.block);
        setTopic(""); setUnit(""); setSummary("");
        toast.success(`Bloque ${res.block.code} creado — entra al plan de hoy`);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Plus size={15} className="text-primary" /> Nuevo bloque de estudio</p>
      <div className="grid grid-cols-2 gap-2">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground">
          <option value="">Materia…</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>
        <select value={parcial} onChange={(e) => setParcial(e.target.value)} className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground">
          {[1, 2, 3, 4].map((p) => <option key={p} value={p}>Parcial {p}</option>)}
        </select>
      </div>
      <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tema del bloque (ej. Derivadas parciales)" className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground" />
      <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unidad (opcional)" className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground" />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">Importancia
          <select value={importance} onChange={(e) => setImportance(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground">
            <option value="1">Baja</option><option value="2">Media</option><option value="3">Alta</option><option value="4">Muy alta</option>
          </select>
        </label>
        <label className="text-xs text-muted">Dificultad
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground">
            <option value="1">Fácil</option><option value="2">Media</option><option value="3">Difícil</option><option value="4">Muy difícil</option>
          </select>
        </label>
      </div>
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Resumen / puntos clave del tema (opcional)…" rows={2} className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground resize-y" />
      <button onClick={save} disabled={isPending} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Agregar bloque
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
export function StudySystemClient({
  initialSubjects, initialBlocks, initialPlan, stats, notes, reviews,
}: {
  initialSubjects: SubjectDTO[];
  initialBlocks: BlockDTO[];
  initialPlan: { items: PlanItem[]; totalMin: number; budgetMin: number; overflow: PlanItem[] };
  stats: { total: number; byLevel: Record<string, number>; dueToday: number; overdue: number };
  notes: StudyNoteView[];
  reviews: ReviewView[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("hoy");
  const [subjects, setSubjects] = useState(initialSubjects);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [closing, setClosing] = useState<PlanItem | BlockDTO | null>(null);

  const applyClosed = (b: BlockDTO) => {
    setBlocks((prev) => prev.map((x) => (x.id === b.id ? b : x)));
    router.refresh(); // recalcula plan de hoy en el server
  };

  const planItems = initialPlan.items;

  const TABS: { id: Tab; label: string; icon: typeof CalendarClock }[] = [
    { id: "hoy", label: "Plan de hoy", icon: CalendarClock },
    { id: "materias", label: "Materias", icon: BookOpen },
    { id: "tabla", label: "Tabla maestra", icon: Table2 },
    { id: "apuntes", label: "Apuntes IA", icon: Sparkles },
  ];

  return (
    <div className="space-y-5">
      {/* Header + stats */}
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Target size={20} />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">Estudio</h1>
          <p className="text-xs text-muted">Repetición espaciada + recuperación activa. Te digo qué estudiar hoy y cuándo repasarlo.</p>
        </div>
      </div>

      {stats.total > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Para hoy" value={stats.dueToday} tone="primary" />
          <Stat label="Atrasados" value={stats.overdue} tone={stats.overdue > 0 ? "danger" : "muted"} />
          <Stat label="En verde" value={(stats.byLevel.VERDE ?? 0) + (stats.byLevel.CONSOLIDADO ?? 0)} tone="success" />
          <Stat label="Bloques" value={stats.total} tone="muted" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1 overflow-x-auto">
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
                on ? "bg-primary text-white" : "text-muted hover:text-foreground"
              )}
            >
              <t.icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* PLAN DE HOY */}
      {tab === "hoy" && (
        <div className="space-y-3">
          {planItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <CheckCircle2 size={28} className="mx-auto mb-2 text-success" />
              <p className="text-sm font-medium text-foreground">No tenés nada pendiente para hoy 🎉</p>
              <p className="text-xs text-muted mt-1">Agregá bloques desde “Materias” para empezar a estudiar.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-muted">{planItems.length} bloque(s) · ~{initialPlan.totalMin} min</p>
                <p className="text-[11px] text-muted">Ordenado por prioridad</p>
              </div>
              {planItems.map((it) => {
                const m = MASTERY_META[it.masteryLevel] ?? MASTERY_META.ROJO;
                return (
                  <div key={it.id} className={cn("rounded-2xl border bg-surface p-4 space-y-2.5", it.overdueDays > 0 ? "border-danger/40" : "border-border")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono text-muted">{it.code} · {it.subjectCode}</p>
                        <p className="text-sm font-semibold text-foreground">{it.topic}</p>
                      </div>
                      <MasteryBadge level={it.masteryLevel} />
                    </div>
                    <p className="text-xs text-foreground/80 rounded-lg bg-surface-2/40 px-3 py-2">{it.activity}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[11px] text-muted">
                        <span className="inline-flex items-center gap-1"><Clock size={12} /> ~{it.reviewDuration} min</span>
                        <span>{STAGE_LABEL[it.reviewStage] ?? it.reviewStage}</span>
                        {it.overdueDays > 0 && <span className="text-danger font-semibold">atrasado {it.overdueDays}d</span>}
                      </div>
                      <button onClick={() => setClosing(it)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white">
                        Cerrar sesión <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {initialPlan.overflow.length > 0 && (
                <div className="rounded-xl border border-dashed border-border p-3 text-center text-[11px] text-muted">
                  {initialPlan.overflow.length} bloque(s) más quedaron para otro día (no entran en tu tiempo de hoy).
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* MATERIAS */}
      {tab === "materias" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Materias</h2>
            <NewSubject onCreated={(s) => setSubjects((p) => [...p, s])} />
          </div>
          {subjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
              Creá tu primera materia (ej. AM2, FIS2…) para empezar.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {subjects.map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-sm font-bold text-foreground">{s.code}</p>
                  <p className="text-[11px] text-muted truncate">{s.name}</p>
                  <p className="text-[11px] text-muted mt-1">{s.blockCount} bloque(s)</p>
                </div>
              ))}
            </div>
          )}
          {subjects.length > 0 && <NewBlock subjects={subjects} onCreated={(b) => { setBlocks((p) => [...p, b]); router.refresh(); }} />}
        </div>
      )}

      {/* TABLA MAESTRA */}
      {tab === "tabla" && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Tabla maestra · {blocks.length} bloques</h2>
          {blocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">Todavía no cargaste bloques.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-2/40 text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Código</th>
                    <th className="px-3 py-2 text-left font-semibold">Tema</th>
                    <th className="px-3 py-2 text-left font-semibold">Nivel</th>
                    <th className="px-3 py-2 text-left font-semibold">Etapa</th>
                    <th className="px-3 py-2 text-left font-semibold">Próx. repaso</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {blocks.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-2/20">
                      <td className="px-3 py-2 font-mono text-[11px] text-muted whitespace-nowrap">{b.code}</td>
                      <td className="px-3 py-2 text-foreground max-w-[180px] truncate">{b.topic}</td>
                      <td className="px-3 py-2"><MasteryBadge level={b.masteryLevel} /></td>
                      <td className="px-3 py-2 text-[11px] text-muted whitespace-nowrap">{STAGE_LABEL[b.reviewStage] ?? b.reviewStage}</td>
                      <td className="px-3 py-2 text-[11px] text-muted whitespace-nowrap">{fmtDate(b.nextReviewDate)}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => setClosing(b)} className="text-xs font-semibold text-primary hover:underline whitespace-nowrap">Cerrar sesión</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* APUNTES IA (flujo existente) */}
      {tab === "apuntes" && <EstudioClient notes={notes} reviews={reviews} />}

      {closing && <CloseSessionModal block={closing} onClose={() => setClosing(null)} onDone={applyClosed} />}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "primary" | "danger" | "success" | "muted" }) {
  const color = tone === "primary" ? "text-primary" : tone === "danger" ? "text-danger" : tone === "success" ? "text-emerald-500" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center">
      <p className={cn("text-xl font-bold", color)}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
