"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { buildSubjectColors } from "./colors";
import type { BlockDTO, SubjectDTO } from "@/lib/db/study-system";

const WEEKS = 9; // ~2 meses hacia adelante
const DOW = ["L", "M", "M", "J", "V", "S", "D"];
const MAST_DOT: Record<string, string> = { ROJO: "#ef4444", AMARILLO: "#f59e0b", VERDE: "#10b981", CONSOLIDADO: "#0ea5e9" };

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function StudyHeatmap({
  blocks, subjects, onReviewClick,
}: {
  blocks: BlockDTO[];
  subjects: SubjectDTO[];
  onReviewClick: (b: BlockDTO) => void;
}) {
  const colors = buildSubjectColors(subjects);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = keyOf(startToday);
  const [selected, setSelected] = useState<string>(todayKey);

  // Índice día → { subjects: colores distintos, blocks: lista }
  const byDay = useMemo(() => {
    const map = new Map<string, { colors: string[]; blocks: BlockDTO[] }>();
    for (const b of blocks) {
      if (b.status !== "ACTIVO" || !b.nextReviewDate) continue;
      const d = new Date(b.nextReviewDate);
      const k = keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      const entry = map.get(k) ?? { colors: [], blocks: [] };
      const col = colors.get(b.subjectId) ?? "#94a3b8";
      if (!entry.colors.includes(col)) entry.colors.push(col);
      entry.blocks.push(b);
      map.set(k, entry);
    }
    return map;
  }, [blocks, colors]);

  // Grilla: arranca el lunes de esta semana; WEEKS semanas.
  const weeks = useMemo(() => {
    const offset = (startToday.getDay() + 6) % 7; // lunes = 0
    const start = new Date(startToday);
    start.setDate(startToday.getDate() - offset);
    return Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const day = new Date(start);
        day.setDate(start.getDate() + w * 7 + d);
        return day;
      })
    );
  }, [startToday]);

  const selDate = useMemo(() => {
    const [y, m, d] = selected.split("-").map(Number);
    return new Date(y, m, d);
  }, [selected]);
  const selEntry = byDay.get(selected);

  return (
    <div className="space-y-3">
      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {subjects.filter((s) => blocks.some((b) => b.subjectId === s.id)).map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors.get(s.id) }} /> {s.code}
          </span>
        ))}
      </div>

      {/* Grilla */}
      <div className="rounded-2xl border border-border bg-surface p-3 overflow-x-auto">
        <div className="min-w-[320px]">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DOW.map((d, i) => <div key={i} className="text-center text-[9px] font-semibold uppercase text-muted">{d}</div>)}
          </div>
          <div className="space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((day) => {
                  const k = keyOf(day);
                  const entry = byDay.get(k);
                  const isToday = k === todayKey;
                  const isSel = k === selected;
                  const isPast = day < startToday;
                  return (
                    <button
                      key={k}
                      onClick={() => setSelected(k)}
                      className={cn(
                        "relative aspect-square rounded-md overflow-hidden border transition-all",
                        isSel ? "ring-2 ring-primary border-transparent" : "border-border/60 hover:border-primary/50"
                      )}
                      title={day.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "short" })}
                    >
                      {entry && entry.colors.length > 0 && (
                        <div className="absolute inset-0 flex" style={{ opacity: isPast ? 0.45 : 0.92 }}>
                          {entry.colors.map((c, i) => <div key={i} className="flex-1" style={{ background: c }} />)}
                        </div>
                      )}
                      <span className={cn(
                        "absolute inset-0 grid place-items-center text-[10px] font-semibold",
                        entry && entry.colors.length ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" : isToday ? "text-primary" : "text-muted"
                      )}>
                        {day.getDate()}
                      </span>
                      {isToday && <span className="absolute inset-0 rounded-md ring-1 ring-inset ring-primary/70" />}
                      {entry && entry.blocks.length > 1 && (
                        <span className="absolute bottom-0 right-0.5 text-[7px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">{entry.blocks.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detalle del día seleccionado */}
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-2">
        <p className="text-sm font-bold text-foreground capitalize">
          {selDate.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" })}
        </p>
        {!selEntry || selEntry.blocks.length === 0 ? (
          <p className="text-xs text-muted py-2 text-center">Sin repasos este día.</p>
        ) : (
          <div className="space-y-1.5">
            {selEntry.blocks.map((b) => (
              <button key={b.id} onClick={() => onReviewClick(b)} className="w-full flex items-center gap-2.5 rounded-xl border border-border bg-surface-2/30 p-2.5 text-left hover:border-primary/50 transition-colors">
                <span className="h-8 w-1.5 rounded-full shrink-0" style={{ background: colors.get(b.subjectId) }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{b.subjectCode} · {b.topic}</p>
                  <p className="text-[11px] text-muted">{b.code} · ~{b.reviewDuration}′</p>
                </div>
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: MAST_DOT[b.masteryLevel] ?? "#94a3b8" }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
