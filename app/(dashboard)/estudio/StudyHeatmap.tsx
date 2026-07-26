"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { buildSubjectColors } from "./colors";
import type { BlockDTO, SubjectDTO } from "@/lib/db/study-system";

// Vista global tipo "contribuciones": semanas en columnas, días en filas.
const WEEKS_BACK = 2;
const WEEKS_FWD = 24; // ~medio año a la vista
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ROW_LABEL = ["L", "", "M", "", "V", "", ""]; // Lun/Mié/Vie
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

  // Semanas (columnas). Arranca el lunes de (esta semana - WEEKS_BACK).
  const weeks = useMemo(() => {
    const offset = (startToday.getDay() + 6) % 7;
    const start = new Date(startToday);
    start.setDate(startToday.getDate() - offset - WEEKS_BACK * 7);
    const total = WEEKS_BACK + WEEKS_FWD;
    return Array.from({ length: total }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const day = new Date(start);
        day.setDate(start.getDate() + w * 7 + d);
        return day;
      })
    );
  }, [startToday]);

  // Etiqueta de mes por columna (cuando cambia el mes respecto de la semana previa).
  const monthLabels = useMemo(
    () => weeks.map((week, i) => {
      const m = week[0].getMonth();
      const prev = i > 0 ? weeks[i - 1][0].getMonth() : -1;
      return m !== prev ? MONTHS[m] : "";
    }),
    [weeks]
  );

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

      {/* Grilla global (scroll horizontal) */}
      <div className="rounded-2xl border border-border bg-surface p-3 overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          {/* Meses */}
          <div className="flex gap-[2px] pl-5">
            {monthLabels.map((lbl, i) => (
              <div key={i} className="w-3 text-[8px] text-muted overflow-visible whitespace-nowrap">{lbl}</div>
            ))}
          </div>
          {/* Días (label) + columnas por semana */}
          <div className="flex gap-[2px]">
            <div className="flex flex-col gap-[2px] pr-1">
              {ROW_LABEL.map((l, i) => <div key={i} className="h-3 w-2.5 text-[8px] leading-[12px] text-muted">{l}</div>)}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
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
                      title={`${day.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })}${entry ? ` · ${entry.blocks.length} repaso(s)` : ""}`}
                      className={cn(
                        "relative h-3 w-3 rounded-[2px] overflow-hidden border transition-all",
                        entry ? "border-transparent" : "border-border/50 bg-surface-2/30",
                        isSel && "ring-1 ring-primary ring-offset-1 ring-offset-surface",
                        isToday && !isSel && "ring-1 ring-primary/60"
                      )}
                    >
                      {entry && entry.colors.length > 0 && (
                        <div className="absolute inset-0 flex" style={{ opacity: isPast ? 0.4 : 1 }}>
                          {entry.colors.map((c, i) => <div key={i} className="flex-1" style={{ background: c }} />)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted">Cada cuadradito es un día; el color es la materia a repasar (varios colores = varias materias). Tocá un día para ver el detalle.</p>

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
