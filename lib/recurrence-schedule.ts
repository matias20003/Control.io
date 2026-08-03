export type RecurrenceScheduleInput = {
  frequency: string;
  dayOfMonth: number | null;
  startDate: Date;
  endDate: Date | null;
  lastExecuted: Date | null;
  /** Alta del recurrente. Evita ejecutar períodos anteriores a su creación. */
  createdAt?: Date | null;
};

/**
 * Toda la aritmética de este módulo es en UTC, a propósito.
 *
 * `startDate` se guarda parseando el "YYYY-MM-DD" del formulario, o sea
 * medianoche UTC; y el "hoy" del cron es la medianoche argentina expresada en
 * UTC, cuyo día calendario en UTC es el día argentino correcto. Si se usaran
 * los getters locales, en cualquier deploy que no corra en UTC las fechas se
 * correrían un día — justo el tipo de error que hace que un sueldo se acredite
 * antes de tiempo.
 */
const DAY_MS = 86_400_000;

function utcStartOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function calendarDate(year: number, month: number, day: number): Date {
  // Día 0 del mes siguiente = último día de este mes (ej: 31 → 30 o 28).
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

/**
 * Día del mes elegido. Sale siempre de `startDate` cuando `dayOfMonth` es null
 * (hoy el formulario no lo carga), nunca de la fecha de alta: si alguien da de
 * alta el 31 un sueldo que empieza el 7, el día elegido es el 7.
 */
function targetDayOf(input: RecurrenceScheduleInput): number {
  return input.dayOfMonth ?? utcStartOfDay(input.startDate).getUTCDate();
}

/**
 * Desde cuándo puede ejecutarse: la más tardía entre el inicio y el alta.
 *
 * Un recurrente no puede haber corrido antes de existir. Sin este tope, dar de
 * alta el 31/7 un ingreso con inicio el 7/7 dispara el cobro en el acto, porque
 * el 7 de este mes ya pasó.
 */
function effectiveStart(input: RecurrenceScheduleInput): Date {
  const start = utcStartOfDay(input.startDate);
  if (!input.createdAt) return start;
  const created = utcStartOfDay(input.createdAt);
  return created > start ? created : start;
}

function nextOccurrence(date: Date, frequency: string, targetDay: number): Date | null {
  if (frequency === "DAILY") return addUtcDays(date, 1);
  if (frequency === "WEEKLY") return addUtcDays(date, 7);
  if (frequency === "BIWEEKLY") return addUtcDays(date, 14);
  if (frequency === "MONTHLY") return calendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, targetDay);
  if (frequency === "QUARTERLY") return calendarDate(date.getUTCFullYear(), date.getUTCMonth() + 3, targetDay);
  if (frequency === "YEARLY") return calendarDate(date.getUTCFullYear() + 1, date.getUTCMonth(), targetDay);
  return null;
}

/**
 * Primera fecha en la que corresponde ejecutar un recurrente que nunca corrió.
 *
 * Es la pieza que evita que se adelante: en las frecuencias con día del mes, la
 * primera ejecución NO es la fecha de inicio sino el primer día objetivo que cae
 * en esa fecha o después. Si alguien da de alta el 31/7 un sueldo que cobra el
 * 7, la primera ejecución es el 7/8 — no el mismo 31/7.
 */
export function firstOccurrence(input: RecurrenceScheduleInput): Date {
  const start = effectiveStart(input);
  const targetDay = targetDayOf(input);

  switch (input.frequency) {
    case "MONTHLY": {
      const candidate = calendarDate(start.getUTCFullYear(), start.getUTCMonth(), targetDay);
      return candidate >= start ? candidate : calendarDate(start.getUTCFullYear(), start.getUTCMonth() + 1, targetDay);
    }
    case "QUARTERLY": {
      const candidate = calendarDate(start.getUTCFullYear(), start.getUTCMonth(), targetDay);
      return candidate >= start ? candidate : calendarDate(start.getUTCFullYear(), start.getUTCMonth() + 3, targetDay);
    }
    case "YEARLY": {
      const candidate = calendarDate(start.getUTCFullYear(), start.getUTCMonth(), targetDay);
      return candidate >= start ? candidate : calendarDate(start.getUTCFullYear() + 1, start.getUTCMonth(), targetDay);
    }
    default:
      // DAILY / WEEKLY / BIWEEKLY no tienen día del mes: el ancla es el inicio.
      return start;
  }
}

/**
 * Inicio corrido al período siguiente, o null si la primera ejecución todavía
 * no llegó.
 *
 * Es la contracara de "descontarlo ya": cuando el usuario da de alta un gasto
 * fijo cuyo primer vencimiento cae hoy o ya pasó y elige empezar el mes que
 * viene, movemos el inicio a la próxima fecha en vez de dejar un cobro
 * pendiente que el cron dispararía al otro día.
 */
export function startOfNextPeriod(
  input: RecurrenceScheduleInput,
  today: Date
): Date | null {
  const first = firstOccurrence(input);
  if (isoDay(first) > isoDay(today)) return null;
  return nextOccurrence(first, input.frequency, targetDayOf(input));
}

/** Próxima fecha pendiente de ejecución, o null si el recurrente ya terminó. */
export function getNextDueDate(input: RecurrenceScheduleInput): Date | null {
  const due = input.lastExecuted
    ? nextOccurrence(utcStartOfDay(input.lastExecuted), input.frequency, targetDayOf(input))
    : firstOccurrence(input);
  if (!due) return null;
  if (input.endDate && due > utcStartOfDay(input.endDate)) return null;
  return due;
}

/**
 * Día calendario en formato YYYY-MM-DD.
 *
 * Las fechas del sistema conviven con dos anclajes distintos (startDate se
 * guarda como medianoche UTC; el "hoy" del cron es la medianoche argentina
 * expresada en UTC), así que comparar instantes sueltos puede fallar por un día.
 * Comparar el día calendario como texto es inequívoco para los dos.
 */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * ¿Corresponde ejecutar este recurrente en `today`?
 *
 * Nunca da true antes de la fecha configurada por el usuario. Si el cron se
 * salteó días, sí da true después: se ejecuta tarde, nunca temprano.
 */
export function isRecurringDue(input: RecurrenceScheduleInput, today: Date): boolean {
  const due = getNextDueDate(input);
  if (!due) return false;
  return isoDay(due) <= isoDay(today);
}

export function getRecurringOccurrences(
  recurring: RecurrenceScheduleInput,
  from: Date,
  to: Date
): Date[] {
  const lower = utcStartOfDay(from);
  const upper = utcStartOfDay(to);
  const end = recurring.endDate ? utcStartOfDay(recurring.endDate) : null;
  const targetDay = targetDayOf(recurring);

  let cursor = recurring.lastExecuted
    ? nextOccurrence(utcStartOfDay(recurring.lastExecuted), recurring.frequency, targetDay)
    : firstOccurrence(recurring);
  if (!cursor) return [];

  let guard = 0;
  while (cursor < lower && guard < 5000) {
    const next = nextOccurrence(cursor, recurring.frequency, targetDay);
    if (!next) return [];
    cursor = next;
    guard++;
  }

  const occurrences: Date[] = [];
  while (cursor <= upper && (!end || cursor <= end) && occurrences.length < 366) {
    occurrences.push(cursor);
    const next = nextOccurrence(cursor, recurring.frequency, targetDay);
    if (!next) break;
    cursor = next;
  }
  return occurrences;
}
