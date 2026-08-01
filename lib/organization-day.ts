/**
 * Qué entra en el plan de un día y en qué orden.
 *
 * El modelo distingue dos fechas que antes estaban fusionadas:
 *   scheduledStart -> "cuándo lo hago". Lo decidís vos.
 *   dueDate        -> "cuándo vence". Lo impone algo de afuera.
 *
 * Y distingue si lo agendado tiene bloque horario o es del día entero:
 *   scheduledEnd != null -> hay hora (y por eso se espeja en Google Calendar).
 *   scheduledEnd == null -> reservada para ese día, sin hora.
 *
 * Gracias a eso, Hoy muestra lo que decidiste hacer hoy en lugar de todo lo que
 * tiene fecha, que era lo que volvía inútil la vista.
 */

export const ARG_TIMEZONE = "America/Argentina/Buenos_Aires";

export type DayTask = {
  id: string;
  dueDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  someday: boolean;
  done: boolean;
  priority: string;
  urgent: boolean;
  important: boolean;
  order: number;
};

/** Día calendario argentino de una fecha ISO, como "YYYY-MM-DD". */
export function argDay(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ARG_TIMEZONE });
}

/** Una tarea tiene hora sólo si tiene bloque (start + end). */
export function hasTime(task: Pick<DayTask, "scheduledStart" | "scheduledEnd">): boolean {
  return !!task.scheduledStart && !!task.scheduledEnd;
}

/** El día para el que la reservaste, si la reservaste. */
export function scheduledDay(task: Pick<DayTask, "scheduledStart">): string | null {
  return task.scheduledStart ? argDay(task.scheduledStart) : null;
}

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };

/** Sin hora que mande, ordena la prioridad y después la matriz urgente/importante. */
export function byPriority(a: DayTask, b: DayTask): number {
  const priority = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
  if (priority !== 0) return priority;
  const weight = (task: DayTask) => (task.urgent ? 2 : 0) + (task.important ? 1 : 0);
  const importance = weight(b) - weight(a);
  if (importance !== 0) return importance;
  return a.order - b.order;
}

export type DayPlan<T extends DayTask> = {
  /** Venció o estaba agendada para antes de hoy y sigue abierta. Nunca se esconde. */
  overdue: T[];
  /** Agendada hoy con bloque horario, en orden cronológico. */
  timed: T[];
  /** Vence hoy pero no la agendaste: la restricción es de afuera. */
  due: T[];
  /** Reservada para hoy sin hora, por prioridad. */
  untimed: T[];
  total: number;
};

/**
 * Reparte las tareas en el plan de un día.
 *
 * `day` es el día que se está mirando y `todayKey` el día real: sólo se marca
 * como atrasado cuando se mira hoy, porque "atrasado" no significa nada si
 * estás mirando la semana que viene.
 */
export function planForDay<T extends DayTask>(tasks: T[], day: string, todayKey: string): DayPlan<T> {
  const overdue: T[] = [];
  const timed: T[] = [];
  const due: T[] = [];
  const untimed: T[] = [];
  const lookingAtToday = day === todayKey;

  for (const task of tasks) {
    if (task.done || task.someday) continue;

    const scheduled = scheduledDay(task);
    const dueDay = task.dueDate ? argDay(task.dueDate) : null;

    // Lo que quedó atrás sólo aparece cuando mirás hoy, y aparece siempre:
    // esconderlo es exactamente cuando más importa verlo.
    if (lookingAtToday && ((scheduled && scheduled < day) || (dueDay && dueDay < day))) {
      overdue.push(task);
      continue;
    }

    if (scheduled === day) {
      if (hasTime(task)) timed.push(task);
      else untimed.push(task);
      continue;
    }
    // No la agendaste para hoy, pero vence hoy: hay que verla igual.
    if (dueDay === day) due.push(task);
  }

  timed.sort((a, b) => Date.parse(a.scheduledStart!) - Date.parse(b.scheduledStart!));
  due.sort(byPriority);
  untimed.sort(byPriority);
  overdue.sort(byPriority);

  return { overdue, timed, due, untimed, total: overdue.length + timed.length + due.length + untimed.length };
}

/** Lo que va en la vista Semana de un día: todo lo agendado ahí, sin esconder nada. */
export function scheduledOn<T extends DayTask>(tasks: T[], day: string): T[] {
  return tasks
    .filter((task) => !task.done && !task.someday && (scheduledDay(task) === day || (task.dueDate && argDay(task.dueDate) === day)))
    .sort((a, b) => {
      const aTime = hasTime(a);
      const bTime = hasTime(b);
      if (aTime && bTime) return Date.parse(a.scheduledStart!) - Date.parse(b.scheduledStart!);
      if (aTime) return -1;
      if (bTime) return 1;
      return byPriority(a, b);
    });
}

/** Lo que todavía no tiene día ni está en Algún día: el Inbox a vaciar. */
export function inboxOf<T extends DayTask>(tasks: T[]): T[] {
  return tasks
    .filter((task) => !task.done && !task.someday && !task.scheduledStart && !task.dueDate)
    .sort(byPriority);
}
