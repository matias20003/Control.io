"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, GraduationCap, CalendarDays, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCalendarEventsAction } from "@/app/actions/study-system";
import type { BlockDTO, ExamDTO } from "@/lib/db/study-system";

type CalEvt = { title: string; start: string; allDay: boolean };
type DayItem =
  | { kind: "review"; block: BlockDTO; label: string; sub: string }
  | { kind: "exam"; label: string; sub: string }
  | { kind: "event"; label: string; sub: string };

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const STAGE_LABEL: Record<string, string> = {
  "D0": "Estudio inicial", "D+1": "Repaso D+1", "D+3": "Repaso D+3", "D+7": "Repaso D+7",
  "D+16": "Repaso D+16", "MANT_SEM": "Mantenimiento", "MANT_QUIN": "Mantenimiento",
};

/** Clave local YYYY-M-D de una fecha (para agrupar por el día que ve el usuario). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function keyFromIso(iso: string): string {
  return dayKey(new Date(iso));
}

export function StudyCalendar({
  blocks, exams, onReviewClick,
}: {
  blocks: BlockDTO[];
  exams: ExamDTO[];
  onReviewClick: (b: BlockDTO) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(dayKey(today));
  const [events, setEvents] = useState<CalEvt[]>([]);

  // Traemos los eventos de Google una vez (ventana amplia). Si no hay calendario
  // conectado, la action devuelve error y simplemente no mostramos eventos.
  useEffect(() => {
    let alive = true;
    getCalendarEventsAction(75).then((r) => { if (alive && r.success && r.events) setEvents(r.events); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Índice: clave de día → items (repasos + parciales + eventos)
  const byDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (k: string, it: DayItem) => { const a = map.get(k) ?? []; a.push(it); map.set(k, a); };
    for (const b of blocks) {
      if (b.status !== "ACTIVO" || !b.nextReviewDate) continue;
      push(keyFromIso(b.nextReviewDate), { kind: "review", block: b, label: `${b.subjectCode} — ${b.topic}`, sub: `${STAGE_LABEL[b.reviewStage] ?? b.reviewStage} · ~${b.reviewDuration}′` });
    }
    for (const e of exams) {
      if (e.done) continue;
      push(keyFromIso(e.examDate), { kind: "exam", label: `${e.subjectCode} — ${e.title}`, sub: "Parcial / entrega" });
    }
    for (const ev of events) {
      push(keyFromIso(ev.start), { kind: "event", label: ev.title, sub: ev.allDay ? "Todo el día" : new Date(ev.start).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) });
    }
    return map;
  }, [blocks, exams, events]);

  // Celdas del mes (6 semanas, arranca lunes)
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // lunes = 0
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const todayKey = dayKey(today);
  const selItems = byDay.get(selected) ?? [];
  const selDate = useMemo(() => {
    const [y, m, d] = selected.split("-").map(Number);
    return new Date(y, m, d);
  }, [selected]);

  const dotColor = (k: DayItem["kind"]) => (k === "review" ? "bg-primary" : k === "exam" ? "bg-red-500" : "bg-muted");

  return (
    <div className="space-y-3">
      {/* Header mes */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-lg p-2 text-muted hover:text-foreground hover:bg-surface-2"><ChevronLeft size={18} /></button>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</p>
          <button onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); setSelected(dayKey(t)); }} className="text-[11px] text-primary hover:underline">Hoy</button>
        </div>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-lg p-2 text-muted hover:text-foreground hover:bg-surface-2"><ChevronRight size={18} /></button>
      </div>

      {/* Grilla */}
      <div className="rounded-2xl border border-border bg-surface p-2">
        <div className="grid grid-cols-7 mb-1">
          {DOW.map((d) => <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            const k = dayKey(d);
            const items = byDay.get(k) ?? [];
            const otherMonth = d.getMonth() !== cursor.getMonth();
            const isToday = k === todayKey;
            const isSel = k === selected;
            const kinds = [...new Set(items.map((it) => it.kind))];
            return (
              <button
                key={i}
                onClick={() => setSelected(k)}
                className={cn(
                  "aspect-square rounded-lg p-1 flex flex-col items-center gap-0.5 transition-colors",
                  isSel ? "bg-primary/15 ring-1 ring-primary/50" : "hover:bg-surface-2",
                  otherMonth && "opacity-35"
                )}
              >
                <span className={cn(
                  "text-xs grid place-items-center h-6 w-6 rounded-full",
                  isToday ? "bg-primary text-white font-bold" : "text-foreground"
                )}>{d.getDate()}</span>
                <div className="flex items-center gap-0.5 h-1.5">
                  {kinds.slice(0, 3).map((kk) => <span key={kk} className={cn("h-1.5 w-1.5 rounded-full", dotColor(kk))} />)}
                </div>
                {items.length > 0 && <span className="text-[9px] text-muted leading-none">{items.length}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Repaso</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Parcial</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted" /> Evento</span>
      </div>

      {/* Detalle del día */}
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-2">
        <p className="text-sm font-bold text-foreground capitalize">
          {selDate.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" })}
        </p>
        {selItems.length === 0 ? (
          <p className="text-xs text-muted py-3 text-center">Sin tareas ni eventos este día.</p>
        ) : (
          <div className="space-y-1.5">
            {selItems.map((it, i) => {
              if (it.kind === "review") {
                return (
                  <button key={i} onClick={() => onReviewClick(it.block)} className="w-full flex items-center gap-2.5 rounded-xl border border-border bg-surface-2/30 p-2.5 text-left hover:border-primary/50 transition-colors">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><BookOpen size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{it.label}</p>
                      <p className="text-[11px] text-muted">{it.sub}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-primary shrink-0">Cerrar sesión →</span>
                  </button>
                );
              }
              const isExam = it.kind === "exam";
              return (
                <div key={i} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2/30 p-2.5">
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", isExam ? "bg-red-500/10 text-red-500" : "bg-surface-2 text-muted")}>
                    {isExam ? <GraduationCap size={15} /> : <CalendarDays size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{it.label}</p>
                    <p className="text-[11px] text-muted flex items-center gap-1">{!isExam && <Clock size={10} />}{it.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
