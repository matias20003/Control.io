"use client";

/**
 * El repartidor: cargás el material y la fecha del examen, y queda repartido
 * entre los días que faltan.
 *
 * La función que la gente cita como razón para quedarse en el único producto
 * que validó esta idea no es armar el plan: es el botón que lo reacomoda
 * cuando te atrasaste. Por eso el rebalanceo está siempre a la vista y no
 * escondido en un menú — todo el mundo se atrasa, y un plan que no se puede
 * reacomodar se abandona el primer día que no se cumple.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, ChevronRight, Clock3, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createStudyPlanAction, deleteStudyPlanAction, rebalancePlanAction, togglePlanItemAction,
} from "@/app/actions/study-career";
import type { StudyPlanData } from "@/lib/db/study-career";
import { feasibility } from "@/lib/study-planner";

const TZ = "America/Argentina/Buenos_Aires";
const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

const WEEKDAYS = [
  { index: 1, label: "L" }, { index: 2, label: "M" }, { index: 3, label: "M" },
  { index: 4, label: "J" }, { index: 5, label: "V" }, { index: 6, label: "S" }, { index: 0, label: "D" },
];

const fmtDay = (day: string) =>
  new Date(`${day}T12:00:00-03:00`).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });

const fmtMinutes = (minutes: number) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes}m`;

type Exam = { id: string; title: string; examDate: string; subjectName: string };

export function PlanEstudioClient({ plans, exams }: { plans: StudyPlanData[]; exams: Exam[] }) {
  const [creating, setCreating] = useState(false);
  const sinPlan = exams.filter((exam) => !plans.some((plan) => plan.examId === exam.id));

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plan de estudio</h1>
          <p className="mt-1 text-sm text-muted">Tu material repartido entre los días que faltan.</p>
        </div>
        {sinPlan.length > 0 && (
          <button onClick={() => setCreating(!creating)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white">
            <Plus size={17} /> Armar un plan
          </button>
        )}
      </header>

      {creating && <NewPlan exams={sinPlan} onDone={() => setCreating(false)} />}

      {plans.length === 0 && !creating && (
        <p className="rounded-2xl border border-dashed border-border bg-surface/40 px-4 py-10 text-center text-sm text-muted">
          {exams.length === 0
            ? "Cargá un parcial en Estudio y después volvé acá para repartir el material."
            : "Todavía no armaste ningún plan. Elegí un examen y cargá lo que entra."}
        </p>
      )}

      {plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
    </main>
  );
}

function PlanCard({ plan }: { plan: StudyPlanData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = todayKey();
  const examDay = plan.examDate.slice(0, 10);

  const pendientes = plan.items.filter((item) => !item.done);
  const hechos = plan.items.length - pendientes.length;
  // Lo que quedó agendado antes de hoy y sin hacer: la medida real del atraso.
  const atrasados = pendientes.filter((item) => item.scheduledFor && item.scheduledFor < today);
  const check = useMemo(
    () => feasibility(
      plan.items.map((item) => ({ ...item, scheduledFor: null })),
      today, examDay,
      { minutesPerDay: plan.minutesPerDay, reviewDays: plan.reviewDays },
    ),
    [plan, today, examDay],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, typeof pendientes>();
    for (const item of pendientes) {
      const key = item.scheduledFor ?? "sin-fecha";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [pendientes]);

  const daysLeft = Math.max(0, Math.round((Date.parse(`${examDay}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000));

  const rebalanceNow = () => start(async () => {
    const result = await rebalancePlanAction(plan.id, today);
    if (result.error) { toast.error(result.error); return; }
    toast.success(
      result.missingMinutes
        ? `Reacomodado. Faltan ${fmtMinutes(result.missingMinutes)} que no entran: sacá algo o sumá tiempo.`
        : "Reacomodado: todo entra en los días que quedan.",
    );
    router.refresh();
  });

  const toggle = (itemId: string) => start(async () => {
    const result = await togglePlanItemAction(itemId);
    if (result.error) toast.error(result.error);
    else router.refresh();
  });

  const remove = () => start(async () => {
    const result = await deleteStudyPlanAction(plan.id);
    if (result.error) toast.error(result.error);
    else { toast.success("Plan borrado"); router.refresh(); }
  });

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <CalendarClock size={16} className="text-primary" />
        <h2 className="font-semibold text-foreground">{plan.examTitle}</h2>
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
          {daysLeft === 0 ? "es hoy" : daysLeft === 1 ? "falta 1 día" : `faltan ${daysLeft} días`}
        </span>
        <span className="text-xs text-muted">{hechos}/{plan.items.length} listo</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={rebalanceNow} disabled={pending}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-primary/40 px-3 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50">
            <RefreshCw size={13} className={pending ? "animate-spin" : ""} /> Reacomodar
          </button>
          <button aria-label="Borrar plan" onClick={remove} disabled={pending}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger">
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      {/* La cuenta honesta, antes de que la descubra el día del examen. */}
      {!check.fits && (
        <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600">
          Te queda {fmtMinutes(check.neededMinutes)} de material y {fmtMinutes(check.availableMinutes)} de tiempo.
          Harían falta {fmtMinutes(check.minutesPerDayNeeded)} por día: sacá temas o sumá horas.
        </p>
      )}

      {atrasados.length > 0 && (
        <p className="mb-3 flex items-center gap-2 text-xs text-muted">
          <ChevronRight size={13} className="text-primary" />
          {atrasados.length} {atrasados.length === 1 ? "tema quedó" : "temas quedaron"} de días anteriores.
          Tocá Reacomodar y se reparten en lo que falta.
        </p>
      )}

      <div className="space-y-3">
        {byDay.map(([day, items]) => (
          <div key={day}>
            <p className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${
              day === today ? "text-primary" : day < today ? "text-muted" : "text-muted"
            }`}>
              {day === "sin-fecha" ? "Sin fecha" : day === today ? "Hoy" : fmtDay(day)}
              <span className="ml-2 font-normal normal-case opacity-70">
                {fmtMinutes(items.reduce((sum, item) => sum + item.minutes, 0))}
              </span>
            </p>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.id}>
                  <button onClick={() => toggle(item.id)} disabled={pending}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-border/70 bg-surface px-3 py-2.5 text-left transition-colors hover:border-primary/40 disabled:opacity-60">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.title}</span>
                    {item.isReview && <span className="shrink-0 text-[10px] text-primary">repaso</span>}
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted">
                      <Clock3 size={11} />{fmtMinutes(item.minutes)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {pendientes.length === 0 && (
          <p className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-3 text-sm font-medium text-success">
            <Check size={15} /> Terminaste todo el material. Ahora descansá.
          </p>
        )}
      </div>
    </section>
  );
}

function NewPlan({ exams, onDone }: { exams: Exam[]; onDone: () => void }) {
  const router = useRouter();
  const [examId, setExamId] = useState(exams[0]?.id ?? "");
  const [raw, setRaw] = useState("");
  const [minutes, setMinutes] = useState(45);
  const [perDay, setPerDay] = useState<number[]>([0, 90, 90, 90, 90, 90, 60]);
  const [reviewDays, setReviewDays] = useState(2);
  const [pending, start] = useTransition();

  // Una línea por tema: escribir es más rápido que llenar un formulario por
  // cada unidad, y el programa de la materia ya viene en forma de lista.
  const items = raw.split("\n").map((line) => line.trim()).filter(Boolean);

  const create = () => start(async () => {
    const result = await createStudyPlanAction({
      examId,
      minutesPerDay: perDay,
      reviewDays,
      today: todayKey(),
      items: items.map((title) => ({ title, minutes, weight: 2 })),
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success("Plan armado");
    onDone();
    router.refresh();
  });

  const input = "min-h-11 rounded-xl border border-border bg-background px-3 text-sm";

  return (
    <section className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <select value={examId} onChange={(e) => setExamId(e.target.value)} aria-label="Examen" className={`${input} w-full`}>
        {exams.map((exam) => (
          <option key={exam.id} value={exam.id}>
            {exam.subjectName} · {exam.title} · {fmtDay(exam.examDate.slice(0, 10))}
          </option>
        ))}
      </select>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Qué entra, un tema por línea
        </label>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6}
          placeholder={"Unidad 1: Límites\nUnidad 2: Derivadas\nPráctica 3\n…"}
          className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <p className="mt-1 text-[11px] text-muted">{items.length} temas</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Cada tema lleva
          <input type="number" min={5} max={600} step={5} value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))} className={`${input} w-20`} />
          min
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Últimos
          <input type="number" min={0} max={14} value={reviewDays}
            onChange={(e) => setReviewDays(Number(e.target.value))} className={`${input} w-16`} />
          días para repasar
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Cuánto puedo estudiar por día</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((weekday) => (
            <label key={weekday.index} className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-muted">{weekday.label}</span>
              <input
                type="number" min={0} max={720} step={15}
                value={perDay[weekday.index]}
                onChange={(e) => setPerDay((current) => {
                  const next = [...current];
                  next[weekday.index] = Number(e.target.value);
                  return next;
                })}
                aria-label={`Minutos el día ${weekday.label}`}
                className="min-h-11 w-16 rounded-xl border border-border bg-background px-2 text-center text-sm"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="min-h-11 px-3 text-sm text-muted">Cancelar</button>
        <button onClick={create} disabled={pending || !examId || items.length === 0}
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40">
          Repartir el material
        </button>
      </div>
    </section>
  );
}
