"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selector de un lapso con dos calendarios: uno de inicio y otro de fin.
 *
 * Trabaja con días calendario sueltos ("YYYY-MM-DD"), nunca con instantes. Un
 * `new Date("2026-08-03")` se lee como medianoche UTC y en hora argentina cae
 * el día anterior: el usuario elegiría el 3 y el filtro diría 2. Por eso las
 * fechas se arman y se leen siempre con getters locales.
 */

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DOW = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

export function toDayString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-08-03" → Date local del 3/8, sin pasar por el parser UTC. */
function fromDayString(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatDayString(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** Las 42 celdas del mes del cursor, arrancando en lunes. */
function monthCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // lunes = 0
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function MonthGrid({
  title,
  cursor,
  onCursorChange,
  selected,
  rangeStart,
  rangeEnd,
  onPick,
}: {
  title: string;
  cursor: Date;
  onCursorChange: (d: Date) => void;
  selected: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  onPick: (day: string) => void;
}) {
  const cells = useMemo(() => monthCells(cursor), [cursor]);
  const todayKey = toDayString(new Date());

  return (
    <div className="w-[15.5rem]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">{title}</p>
      <div className="flex items-center justify-between mb-1">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-2"
        >
          <ChevronLeft size={15} />
        </button>
        <p className="text-xs font-bold text-foreground">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </p>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-2"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DOW.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase text-muted py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          const key = toDayString(d);
          const otherMonth = d.getMonth() !== cursor.getMonth();
          // Dentro del lapso: se pinta en los dos calendarios, así se ve de un
          // vistazo qué quedó abarcado y no solo dónde están las dos puntas.
          const inRange = !!rangeStart && !!rangeEnd && key >= rangeStart && key <= rangeEnd;
          const isEdge = key === rangeStart || key === rangeEnd;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(key)}
              className={cn(
                "h-7 rounded-lg text-xs transition-colors",
                otherMonth && "opacity-35",
                key === selected
                  ? "bg-primary text-white font-bold"
                  : isEdge
                    ? "bg-primary/25 text-foreground font-semibold"
                    : inRange
                      ? "bg-primary/10 text-foreground"
                      : "text-foreground hover:bg-surface-2",
                key === todayKey && key !== selected && "ring-1 ring-primary/50"
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({
  from,
  to,
  onChange,
  className,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  const today = new Date();
  const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [fromCursor, setFromCursor] = useState(() => fromDayString(from) ?? startOfThisMonth);
  const [toCursor, setToCursor] = useState(() => fromDayString(to) ?? startOfThisMonth);

  // Cerrar al clickear afuera o con Escape: el panel tapa la tabla de abajo.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Para pintar, las puntas van ordenadas. Elegir un inicio posterior al fin no
  // es un error que valga la pena retar: se muestra el lapso dado vuelta y el
  // filtro lo interpreta igual.
  const [rangeStart, rangeEnd] = from && to && from > to ? [to, from] : [from || null, to || null];

  const label = from && to
    ? `${formatDayString(from)} → ${formatDayString(to)}`
    : from
      ? `Desde ${formatDayString(from)}`
      : to
        ? `Hasta ${formatDayString(to)}`
        : "Elegir fechas";

  return (
    <div ref={wrapper} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
          from || to ? "bg-primary/15 text-foreground" : "bg-surface-2 text-muted hover:text-foreground"
        )}
      >
        <CalendarDays size={13} />
        {label}
      </button>

      {open && (
        <div className="absolute z-30 mt-2 left-0 rounded-2xl border border-border bg-surface p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row gap-5">
            <MonthGrid
              title="Inicio"
              cursor={fromCursor}
              onCursorChange={setFromCursor}
              selected={from || null}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onPick={(day) => {
                onChange({ from: day, to });
                // Si el fin todavía no se eligió, el segundo calendario se
                // acomoda al mes del inicio: casi siempre el lapso arranca ahí.
                if (!to) setToCursor(fromDayString(day) ?? toCursor);
              }}
            />
            <MonthGrid
              title="Fin"
              cursor={toCursor}
              onCursorChange={setToCursor}
              selected={to || null}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onPick={(day) => onChange({ from, to: day })}
            />
          </div>

          <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => {
                onChange({ from: "", to: "" });
                setFromCursor(startOfThisMonth);
                setToCursor(startOfThisMonth);
              }}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground"
            >
              <X size={12} />
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:opacity-90"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
