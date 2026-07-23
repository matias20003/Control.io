"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock, BookOpen, Table2, Sparkles, Plus, Loader2, X,
  Clock, Target, ChevronRight, CheckCircle2, AlertCircle, Settings2,
  GraduationCap, ListChecks, RefreshCw, Trash2, CalendarDays, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createSubjectAction, createBlockAction, closeSessionAction,
  createExamAction, toggleExamAction, deleteExamAction,
  createExerciseAction, toggleExerciseAction, deleteExerciseAction,
  setAvailabilityAction, reprogramarAction, summarizeForBlockAction,
  setStudyNotifyAction, postponeBlockAction, deleteBlocksAction,
} from "@/app/actions/study-system";
import type {
  SubjectDTO, BlockDTO, PlanItem, ExamDTO, ExerciseDTO, ErrorLogDTO, AvailabilityDTO,
} from "@/lib/db/study-system";
import { EstudioClient } from "./EstudioClient";
import { IngestMaterial } from "./IngestMaterial";
import { NotionCalendar } from "./NotionCalendar";
import { StudyCalendar } from "./StudyCalendar";
import type { StudyNoteView, ReviewView } from "@/lib/db/study";

type Tab = "hoy" | "materias" | "tabla" | "parciales" | "pendientes" | "apuntes";

const DAY_NAME: Record<number, string> = { 0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado" };
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

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

  const postpone = () => {
    start(async () => {
      const res = await postponeBlockAction(block.id);
      if (res.error) { toast.error(res.error); return; }
      if (res.success && res.block) {
        onDone(res.block);
        toast.success(`Lo pasé para ${res.block.nextReviewDate ? fmtDate(res.block.nextReviewDate) : "el próximo día"} — sin marcar resultado`);
        onClose();
      }
    });
  };

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
        <button
          onClick={postpone} disabled={isPending}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
        >
          No llegué a verlo → pasarlo a otro día
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
  const [raw, setRaw] = useState("");
  const [isPending, start] = useTransition();
  const [summarizing, startSummarize] = useTransition();

  const selectedCode = subjects.find((s) => s.id === subjectId)?.code;

  const summarize = () => {
    if (raw.trim().length < 30) { toast.error("Pegá el texto del apunte para resumir"); return; }
    startSummarize(async () => {
      const res = await summarizeForBlockAction({ text: raw.trim(), hintSubject: selectedCode });
      if (res.error) { toast.error(res.error); return; }
      if (res.success) {
        if (res.summary) setSummary(res.summary);
        if (res.topic && !topic.trim()) setTopic(res.topic);
        toast.success("Resumen generado ✍️ revisalo y guardá");
      }
    });
  };

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
        setTopic(""); setUnit(""); setSummary(""); setRaw("");
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
      {/* Resumen con IA: pegás el apunte y la IA arma el resumen + propone el tema */}
      <div className="rounded-lg border border-dashed border-border p-2.5 space-y-2">
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="¿Tenés el apunte? Pegá el texto acá y la IA te arma el resumen y propone el tema…" rows={2} className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground resize-y" />
        <button onClick={summarize} disabled={summarizing} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50">
          {summarizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Resumir con IA
        </button>
      </div>
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Resumen / puntos clave del tema (opcional)…" rows={3} className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground resize-y" />
      <button onClick={save} disabled={isPending} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Agregar bloque
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Modal de disponibilidad semanal
// ─────────────────────────────────────────────
function AvailabilityModal({
  availability, settings, onClose, onSaved,
}: {
  availability: AvailabilityDTO[];
  settings: { planHour: number; planMinute: number; notifyEnabled: boolean };
  onClose: () => void;
  onSaved: (day: number, minutes: number) => void;
}) {
  const map = new Map(availability.map((a) => [a.dayOfWeek, a.minutes]));
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(DAY_ORDER.map((d) => [d, String(((map.get(d) ?? 0) / 60).toFixed(1)).replace(".0", "")]))
  );
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [notifyEnabled, setNotifyEnabled] = useState(settings.notifyEnabled);
  const [planTime, setPlanTime] = useState(`${String(settings.planHour).padStart(2, "0")}:${String(settings.planMinute).padStart(2, "0")}`);
  const [savingNotify, setSavingNotify] = useState(false);

  const saveNotify = async (enabled: boolean, time: string) => {
    const [hh, mm] = time.split(":").map(Number);
    setSavingNotify(true);
    const res = await setStudyNotifyAction({ planHour: hh, planMinute: mm, notifyEnabled: enabled });
    setSavingNotify(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(enabled ? `Aviso diario a las ${time} ⏰` : "Aviso diario desactivado");
  };

  const saveDay = async (day: number) => {
    const hours = parseFloat(values[day] || "0");
    if (isNaN(hours) || hours < 0) { toast.error("Horas inválidas"); return; }
    const minutes = Math.round(hours * 60);
    setSavingDay(day);
    const res = await setAvailabilityAction(day, minutes);
    setSavingDay(null);
    if (res.error) { toast.error(res.error); return; }
    onSaved(day, minutes);
    toast.success(`${DAY_NAME[day]}: ${hours || 0} h${res.moved ? ` · reacomodé ${res.moved} repaso(s)` : ""}`);
  };

  const total = DAY_ORDER.reduce((acc, d) => acc + (parseFloat(values[d] || "0") || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-border bg-surface p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><CalendarDays size={17} /> Disponibilidad semanal</h3>
            <p className="text-[11px] text-muted">Cuántas horas tenés para estudiar cada día. 0 = descanso.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="space-y-1.5">
          {DAY_ORDER.map((d) => (
            <div key={d} className="flex items-center gap-2">
              <span className="w-24 text-sm text-foreground">{DAY_NAME[d]}</span>
              <input
                type="number" step="0.5" min="0" inputMode="decimal"
                value={values[d]}
                onChange={(e) => setValues((v) => ({ ...v, [d]: e.target.value }))}
                onBlur={() => saveDay(d)}
                className="w-20 rounded-lg border border-border bg-surface-2/40 px-3 py-1.5 text-sm text-foreground text-right"
              />
              <span className="text-xs text-muted flex-1">horas</span>
              {savingDay === d && <Loader2 size={14} className="animate-spin text-muted" />}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
          <span className="text-muted">Total semanal</span>
          <span className="font-bold text-foreground">{total.toFixed(1).replace(".0", "")} h</span>
        </div>
        <p className="text-[11px] text-muted">Se guarda al salir de cada casillero. El plan de hoy respeta estas horas.</p>

        {/* Aviso diario por WhatsApp/push */}
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><CalendarClock size={15} /> Aviso diario</p>
              <p className="text-[11px] text-muted">Todas las mañanas te mando qué estudiar por WhatsApp y push.</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="checkbox" checked={notifyEnabled} className="peer sr-only"
                onChange={(e) => { setNotifyEnabled(e.target.checked); saveNotify(e.target.checked, planTime); }} />
              <div className="h-6 w-11 rounded-full bg-surface-2 peer-checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>
          {notifyEnabled && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Horario</span>
              <input type="time" value={planTime}
                onChange={(e) => setPlanTime(e.target.value)}
                onBlur={() => saveNotify(notifyEnabled, planTime)}
                className="rounded-lg border border-border bg-surface-2/40 px-3 py-1.5 text-sm text-foreground [color-scheme:dark]" />
              {savingNotify && <Loader2 size={14} className="animate-spin text-muted" />}
              <span className="text-[11px] text-muted">hora de Argentina</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Pestaña Parciales / objetivos
// ─────────────────────────────────────────────
function ExamsTab({
  subjects, exams, setExams,
}: {
  subjects: SubjectDTO[];
  exams: ExamDTO[];
  setExams: React.Dispatch<React.SetStateAction<ExamDTO[]>>;
}) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [importance, setImportance] = useState("3");
  const [isPending, start] = useTransition();

  const add = () => {
    if (!subjectId) { toast.error("Elegí la materia"); return; }
    if (!title.trim() || !date) { toast.error("Poné título y fecha"); return; }
    start(async () => {
      const res = await createExamAction({ subjectId, title: title.trim(), examDate: date, importance: Number(importance) });
      if (res.error) { toast.error(res.error); return; }
      if (res.success && res.exam) {
        setExams((p) => [...p, res.exam!].sort((a, b) => a.examDate.localeCompare(b.examDate)));
        setTitle(""); setDate("");
        toast.success("Parcial agendado — sube la prioridad de esa materia al acercarse");
        router.refresh();
      }
    });
  };

  const toggle = (id: string, done: boolean) => {
    setExams((p) => p.map((e) => (e.id === id ? { ...e, done } : e)));
    toggleExamAction(id, done).then((r) => { if (r.error) toast.error(r.error); else router.refresh(); });
  };
  const del = (id: string) => {
    const prev = exams;
    setExams((p) => p.filter((e) => e.id !== id));
    deleteExamAction(id).then((r) => { if (r.error) { toast.error(r.error); setExams(prev); } else router.refresh(); });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><GraduationCap size={15} className="text-primary" /> Nuevo parcial / final</p>
        <div className="grid grid-cols-2 gap-2">
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground">
            <option value="">Materia…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground [color-scheme:dark]" />
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ej. 1º Parcial AM2)" className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground" />
        <div className="flex items-center gap-2">
          <select value={importance} onChange={(e) => setImportance(e.target.value)} className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground">
            <option value="2">Importancia media</option><option value="3">Alta</option><option value="4">Muy alta</option>
          </select>
          <button onClick={add} disabled={isPending} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Agendar
          </button>
        </div>
      </div>

      {exams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">Sin parciales agendados.</div>
      ) : (
        <div className="space-y-2">
          {exams.map((e) => {
            const soon = !e.done && e.daysLeft >= 0 && e.daysLeft <= 7;
            return (
              <div key={e.id} className={cn("flex items-center gap-3 rounded-xl border bg-surface p-3", e.done ? "border-border opacity-60" : soon ? "border-danger/40" : "border-border")}>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold", e.done ? "text-muted line-through" : "text-foreground")}>{e.subjectCode} · {e.title}</p>
                  <p className="text-[11px] text-muted">
                    {new Date(e.examDate).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })}
                    {!e.done && (e.daysLeft < 0 ? " · pasó" : e.daysLeft === 0 ? " · ¡HOY!" : ` · faltan ${e.daysLeft} días`)}
                  </p>
                </div>
                <button onClick={() => toggle(e.id, !e.done)} className="shrink-0 rounded-lg p-1.5 text-muted hover:text-success" title={e.done ? "Reabrir" : "Marcar rendido"}>
                  <CheckCircle2 size={16} className={e.done ? "text-success" : ""} />
                </button>
                <button onClick={() => del(e.id)} className="shrink-0 rounded-lg p-1.5 text-muted hover:text-danger"><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Pestaña Pendientes (ejercicios + errores recientes)
// ─────────────────────────────────────────────
function PendientesTab({
  subjects, blocks, exercises, setExercises, errors,
}: {
  subjects: SubjectDTO[];
  blocks: BlockDTO[];
  exercises: ExerciseDTO[];
  setExercises: React.Dispatch<React.SetStateAction<ExerciseDTO[]>>;
  errors: ErrorLogDTO[];
}) {
  const router = useRouter();
  const [desc, setDesc] = useState("");
  const [blockId, setBlockId] = useState("");
  const [isPending, start] = useTransition();

  const add = () => {
    if (!desc.trim()) { toast.error("Describí el ejercicio"); return; }
    start(async () => {
      const res = await createExerciseAction({ description: desc.trim(), blockId: blockId || undefined });
      if (res.error) { toast.error(res.error); return; }
      setDesc(""); setBlockId("");
      toast.success("Ejercicio agregado");
      router.refresh();
    });
  };
  const toggle = (id: string, done: boolean) => {
    setExercises((p) => p.map((x) => (x.id === id ? { ...x, done } : x)));
    toggleExerciseAction(id, done).then((r) => { if (r.error) toast.error(r.error); });
  };
  const del = (id: string) => {
    const prev = exercises;
    setExercises((p) => p.filter((x) => x.id !== id));
    deleteExerciseAction(id).then((r) => { if (r.error) { toast.error(r.error); setExercises(prev); } });
  };

  const pending = exercises.filter((x) => !x.done);
  const done = exercises.filter((x) => x.done);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><ListChecks size={15} className="text-primary" /> Ejercicio pendiente</p>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej. Guía 3, ej. 5 al 10 (integrales por partes)" className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground" />
        <div className="flex items-center gap-2">
          <select value={blockId} onChange={(e) => setBlockId(e.target.value)} className="flex-1 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground">
            <option value="">Sin bloque asociado</option>
            {blocks.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.topic}</option>)}
          </select>
          <button onClick={add} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Agregar
          </button>
        </div>
        {subjects.length === 0 && <p className="text-[11px] text-muted">Tip: creá materias y bloques para asociarlos.</p>}
      </div>

      {pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Pendientes · {pending.length}</h3>
          {pending.map((x) => (
            <div key={x.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <button onClick={() => toggle(x.id, true)} className="shrink-0 h-5 w-5 rounded-md border-2 border-border hover:border-success" title="Marcar hecho" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{x.description}</p>
                {x.blockCode && <p className="text-[11px] text-muted">{x.blockCode}</p>}
              </div>
              <button onClick={() => del(x.id)} className="shrink-0 rounded-lg p-1.5 text-muted hover:text-danger"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Hechos · {done.length}</h3>
          {done.slice(0, 10).map((x) => (
            <div key={x.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 opacity-60">
              <button onClick={() => toggle(x.id, false)} className="shrink-0 grid h-5 w-5 place-items-center rounded-md bg-success text-white" title="Reabrir"><CheckCircle2 size={13} /></button>
              <p className="text-sm text-muted line-through flex-1 truncate">{x.description}</p>
              <button onClick={() => del(x.id)} className="shrink-0 rounded-lg p-1.5 text-muted hover:text-danger"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {pending.length === 0 && done.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">Sin ejercicios cargados.</div>
      )}

      {errors.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted flex items-center gap-1.5"><AlertCircle size={13} /> Errores recientes</h3>
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden">
            {errors.slice(0, 12).map((e) => (
              <div key={e.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{e.blockCode} · {e.topic}</p>
                  <span className="text-[11px] text-amber-500 shrink-0">{e.category}</span>
                </div>
                {e.description && <p className="text-[11px] text-muted mt-0.5">{e.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
export function StudySystemClient({
  initialSubjects, initialBlocks, initialPlan, stats, notes, reviews,
  initialExams, initialExercises, initialErrors, availability, settings, notion, gcal,
}: {
  initialSubjects: SubjectDTO[];
  initialBlocks: BlockDTO[];
  initialPlan: { items: PlanItem[]; totalMin: number; budgetMin: number; overflow: PlanItem[]; isRestDay: boolean };
  stats: { total: number; byLevel: Record<string, number>; dueToday: number; overdue: number };
  notes: StudyNoteView[];
  reviews: ReviewView[];
  initialExams: ExamDTO[];
  initialExercises: ExerciseDTO[];
  initialErrors: ErrorLogDTO[];
  availability: AvailabilityDTO[];
  settings: { planHour: number; planMinute: number; notifyEnabled: boolean; lastPlanSent: string | null };
  notion: { connected: boolean; dbId: string | null; hasIcs: boolean };
  gcal: { connected: boolean };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("hoy");
  const [subjects, setSubjects] = useState(initialSubjects);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [exams, setExams] = useState(initialExams);
  const [exercises, setExercises] = useState(initialExercises);
  const [avail, setAvail] = useState(availability);
  const [closing, setClosing] = useState<PlanItem | BlockDTO | null>(null);
  const [showAvail, setShowAvail] = useState(false);
  const [tablaView, setTablaView] = useState<"lista" | "calendario">("lista");
  const [tablaSubject, setTablaSubject] = useState<string>(""); // "" = todas
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reprogramming, startReprogram] = useTransition();
  const [deleting, startDelete] = useTransition();

  const filteredBlocks = tablaSubject ? blocks.filter((b) => b.subjectId === tablaSubject) : blocks;
  const toggleSel = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allFilteredSelected = filteredBlocks.length > 0 && filteredBlocks.every((b) => selectedIds.has(b.id));
  const toggleSelAll = () => setSelectedIds((prev) => {
    const n = new Set(prev);
    if (allFilteredSelected) filteredBlocks.forEach((b) => n.delete(b.id));
    else filteredBlocks.forEach((b) => n.add(b.id));
    return n;
  });
  const deleteBlocks = (ids: string[]) => {
    if (!ids.length) return;
    startDelete(async () => {
      const res = await deleteBlocksAction(ids);
      if (res.error) { toast.error(res.error); return; }
      const idSet = new Set(ids);
      setBlocks((prev) => prev.filter((b) => !idSet.has(b.id)));
      setSelectedIds((prev) => { const n = new Set(prev); ids.forEach((i) => n.delete(i)); return n; });
      toast.success(`${res.deleted} bloque(s) eliminados`);
      router.refresh();
    });
  };

  const applyClosed = (b: BlockDTO) => {
    setBlocks((prev) => prev.map((x) => (x.id === b.id ? b : x)));
    router.refresh(); // recalcula plan de hoy en el server
  };

  const reprogramar = () => {
    startReprogram(async () => {
      const res = await reprogramarAction();
      if (res.error) { toast.error(res.error); return; }
      toast.success(res.reprogrammed ? `Reprogramé ${res.reprogrammed} bloque(s) atrasado(s)` : "No había nada atrasado");
      router.refresh();
    });
  };

  const planItems = initialPlan.items;

  const TABS: { id: Tab; label: string; icon: typeof CalendarClock }[] = [
    { id: "hoy", label: "Plan de hoy", icon: CalendarClock },
    { id: "materias", label: "Materias", icon: BookOpen },
    { id: "tabla", label: "Tabla", icon: Table2 },
    { id: "parciales", label: "Parciales", icon: GraduationCap },
    { id: "pendientes", label: "Pendientes", icon: ListChecks },
    { id: "apuntes", label: "Apuntes IA", icon: Sparkles },
  ];

  return (
    <div className="space-y-5">
      {/* Header + stats */}
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Target size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">Estudio</h1>
          <p className="text-xs text-muted">Repetición espaciada + recuperación activa. Te digo qué estudiar hoy y cuándo repasarlo.</p>
        </div>
        <button onClick={() => setShowAvail(true)} className="shrink-0 rounded-lg border border-border p-2 text-muted hover:text-foreground" title="Disponibilidad semanal">
          <Settings2 size={17} />
        </button>
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
          {initialPlan.isRestDay ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <span className="text-3xl">😴</span>
              <p className="text-sm font-medium text-foreground mt-2">Hoy es día de descanso</p>
              <p className="text-xs text-muted mt-1">
                No cargué repasos. {initialPlan.overflow.length > 0 && `Tenés ${initialPlan.overflow.length} bloque(s) esperando para el próximo día hábil.`}
              </p>
              {stats.overdue > 0 && (
                <button onClick={reprogramar} disabled={reprogramming} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:border-primary/50 disabled:opacity-50">
                  {reprogramming ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reorganizar {stats.overdue} atrasado(s)
                </button>
              )}
            </div>
          ) : planItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <CheckCircle2 size={28} className="mx-auto mb-2 text-success" />
              <p className="text-sm font-medium text-foreground">No tenés nada pendiente para hoy 🎉</p>
              <p className="text-xs text-muted mt-1">Agregá bloques desde “Materias” para empezar a estudiar.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-muted">{planItems.length} bloque(s) · ~{initialPlan.totalMin}/{initialPlan.budgetMin} min</p>
                {stats.overdue > 0 ? (
                  <button onClick={reprogramar} disabled={reprogramming} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50">
                    {reprogramming ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Reorganizar atrasados
                  </button>
                ) : (
                  <p className="text-[11px] text-muted">Ordenado por prioridad</p>
                )}
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
                    {it.lastError && (
                      <p className="text-[11px] text-amber-500 flex items-start gap-1">
                        <AlertCircle size={12} className="shrink-0 mt-0.5" /> <span>A reforzar: {it.lastError}</span>
                      </p>
                    )}
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
              {subjects.map((s) => {
                const sb = blocks.filter((b) => b.subjectId === s.id);
                const dominated = sb.filter((b) => b.masteryLevel === "VERDE" || b.masteryLevel === "CONSOLIDADO").length;
                const pct = sb.length ? Math.round((dominated / sb.length) * 100) : 0;
                return (
                  <div key={s.id} className="rounded-xl border border-border bg-surface p-3">
                    <p className="text-sm font-bold text-foreground">{s.code}</p>
                    <p className="text-[11px] text-muted truncate">{s.name}</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-muted mt-1">{dominated}/{sb.length} dominados · {pct}%</p>
                  </div>
                );
              })}
            </div>
          )}
          {subjects.length > 0 && (
            <>
              <IngestMaterial subjects={subjects} onCreated={(bs) => { setBlocks((p) => [...p, ...bs]); router.refresh(); }} />
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground list-none flex items-center gap-1">
                  <Plus size={13} /> …o cargar un bloque a mano
                </summary>
                <div className="mt-2">
                  <NewBlock subjects={subjects} onCreated={(b) => { setBlocks((p) => [...p, b]); router.refresh(); }} />
                </div>
              </details>
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground list-none flex items-center gap-1">
                  <Database size={13} /> Notion y calendario (importar / suscribir)
                </summary>
                <div className="mt-2">
                  <NotionCalendar subjects={subjects} notion={notion} gcal={gcal} onImported={(bs) => { setBlocks((p) => [...p, ...bs]); router.refresh(); }} />
                </div>
              </details>
            </>
          )}
        </div>
      )}

      {/* TABLA MAESTRA */}
      {tab === "tabla" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Tabla maestra · {blocks.length} bloques</h2>
            {/* Toggle Lista / Calendario: la misma info en grilla mensual */}
            <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5">
              <button onClick={() => setTablaView("lista")} className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors", tablaView === "lista" ? "bg-primary text-white" : "text-muted hover:text-foreground")}>
                <Table2 size={12} /> Lista
              </button>
              <button onClick={() => setTablaView("calendario")} className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors", tablaView === "calendario" ? "bg-primary text-white" : "text-muted hover:text-foreground")}>
                <CalendarDays size={12} /> Calendario
              </button>
            </div>
          </div>

          {tablaView === "calendario" ? (
            <StudyCalendar blocks={blocks} exams={exams} onReviewClick={(b) => setClosing(b)} />
          ) : blocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">Todavía no cargaste bloques.</div>
          ) : (
            <>
              {/* Filtro por materia */}
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setTablaSubject("")} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", !tablaSubject ? "bg-primary text-white" : "bg-surface-2 text-muted hover:text-foreground")}>
                  Todas ({blocks.length})
                </button>
                {subjects.map((s) => {
                  const n = blocks.filter((b) => b.subjectId === s.id).length;
                  if (n === 0) return null;
                  return (
                    <button key={s.id} onClick={() => setTablaSubject(s.id)} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", tablaSubject === s.id ? "bg-primary text-white" : "bg-surface-2 text-muted hover:text-foreground")}>
                      {s.code} ({n})
                    </button>
                  );
                })}
              </div>

              {/* Barra de selección */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-danger/40 bg-danger/5 px-3 py-2">
                  <span className="text-xs text-foreground">{selectedIds.size} seleccionado(s)</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted hover:text-foreground">Limpiar</button>
                    <button onClick={() => deleteBlocks([...selectedIds])} disabled={deleting} className="inline-flex items-center gap-1 rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Eliminar
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2/40 text-[11px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-2 py-2 w-8"><input type="checkbox" checked={allFilteredSelected} onChange={toggleSelAll} className="h-3.5 w-3.5 accent-primary" aria-label="Seleccionar todos" /></th>
                      <th className="px-3 py-2 text-left font-semibold">Código</th>
                      <th className="px-3 py-2 text-left font-semibold">Tema</th>
                      <th className="px-3 py-2 text-left font-semibold">Nivel</th>
                      <th className="px-3 py-2 text-left font-semibold">A reforzar</th>
                      <th className="px-3 py-2 text-left font-semibold">Próx. repaso</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredBlocks.map((b) => (
                      <tr key={b.id} className={cn("hover:bg-surface-2/20", selectedIds.has(b.id) && "bg-primary/5")}>
                        <td className="px-2 py-2"><input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleSel(b.id)} className="h-3.5 w-3.5 accent-primary" /></td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted whitespace-nowrap">{b.code}</td>
                        <td className="px-3 py-2 text-foreground max-w-[150px] truncate" title={b.topic}>{b.topic}</td>
                        <td className="px-3 py-2"><MasteryBadge level={b.masteryLevel} /></td>
                        <td className="px-3 py-2 max-w-[160px]">
                          {b.lastError ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-500" title={b.lastError}>
                              <AlertCircle size={11} className="shrink-0" /><span className="truncate">{b.lastError}</span>
                            </span>
                          ) : <span className="text-[11px] text-muted">—</span>}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-muted whitespace-nowrap">{fmtDate(b.nextReviewDate)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button onClick={() => setClosing(b)} className="text-xs font-semibold text-primary hover:underline mr-2">Cerrar</button>
                          <button onClick={() => deleteBlocks([b.id])} disabled={deleting} className="text-muted hover:text-danger" aria-label="Eliminar bloque"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* PARCIALES */}
      {tab === "parciales" && <ExamsTab subjects={subjects} exams={exams} setExams={setExams} />}

      {/* PENDIENTES */}
      {tab === "pendientes" && (
        <PendientesTab subjects={subjects} blocks={blocks} exercises={exercises} setExercises={setExercises} errors={initialErrors} />
      )}

      {/* APUNTES IA (flujo existente) */}
      {tab === "apuntes" && <EstudioClient notes={notes} reviews={reviews} />}

      {closing && <CloseSessionModal block={closing} onClose={() => setClosing(null)} onDone={applyClosed} />}
      {showAvail && (
        <AvailabilityModal
          availability={avail}
          settings={settings}
          onClose={() => { setShowAvail(false); router.refresh(); }}
          onSaved={(day, minutes) => setAvail((prev) => prev.map((a) => (a.dayOfWeek === day ? { ...a, minutes } : a)))}
        />
      )}
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
