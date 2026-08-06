import { getHabitStreak, isHabitDue, type HabitSchedule } from "@/lib/habit-streak";
import { argDay, hasTime, inboxOf, isOpen, planForDay, scheduledOn, type DayTask } from "@/lib/organization-day";

/**
 * El estado de Organización en números, para la portada del pilar.
 *
 * Es la misma foto que ya muestran Hoy, Calendario, Tareas y Hábitos, contada
 * en vez de listada: la portada tiene que responder "¿cómo vengo?" de un
 * vistazo, y recién después mandarte a la sección que corresponda.
 *
 * Todo se calcula acá, sin tocar la base ni el reloj: las funciones reciben el
 * día de hoy como dato. Así se puede testear sin fingir el calendario.
 */

export type HabitLike = HabitSchedule & {
  id: string;
  name: string;
  icon: string | null;
  anchor?: string | null;
  completions: { date: string }[];
};

export type TodayCount = {
  total: number;
  /** Cuántas vienen de días anteriores. Dato interno, no un número para mostrar en rojo. */
  rolled: number;
  timed: number;
  untimed: number;
  due: number;
};

export type HabitsToday = {
  /** Cuántos tocan hoy. */
  due: number;
  done: number;
  pending: number;
  /** Promedio de fuerza de los que tocan hoy: qué tan afirmada está la rutina. */
  strength: number;
  /** Los que tocan hoy y siguen sin marcar, para poder cerrarlos desde acá. */
  pendingHabits: { id: string; name: string; icon: string | null; anchor: string | null; strength: number }[];
};

export type WeekLoad = {
  days: { day: string; count: number; isToday: boolean }[];
  total: number;
  /** El día más cargado de la semana; null si la semana está vacía. */
  busiest: string | null;
};

export type OrganizationSummary = {
  today: TodayCount;
  habits: HabitsToday;
  week: WeekLoad;
  /** Tareas activas sin día asignado: la deuda de planificación. */
  inbox: number;
  someday: number;
  /** Terminadas hoy, que es lo único que mide avance real. */
  doneToday: number;
};

/** Los siete días de la semana de `day`, arrancando el lunes. */
export function weekDaysOf(day: string): string[] {
  const date = new Date(`${day}T00:00:00.000Z`);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(date.getTime() + index * 86_400_000);
    return current.toISOString().slice(0, 10);
  });
}

export function countToday<T extends DayTask>(tasks: T[], today: string): TodayCount {
  const plan = planForDay(tasks, today, today);
  return {
    total: plan.total,
    rolled: plan.rolled,
    timed: plan.timed.length,
    untimed: plan.untimed.length,
    due: plan.due.length,
  };
}

export function summarizeHabits(habits: HabitLike[], today: string): HabitsToday {
  const due = habits.filter((habit) =>
    isHabitDue(today, { frequency: habit.frequency, daysOfWeek: habit.daysOfWeek ?? [] }),
  );
  const scored = due.map((habit) => ({
    habit,
    done: habit.completions.some((completion) => completion.date === today),
    strength: getHabitStreak(
      { frequency: habit.frequency, daysOfWeek: habit.daysOfWeek ?? [] },
      habit.completions.map((completion) => completion.date),
      today,
    ).strength,
  }));
  const pending = scored.filter((entry) => !entry.done);
  return {
    due: due.length,
    done: scored.length - pending.length,
    pending: pending.length,
    strength: scored.length
      ? Math.round(scored.reduce((sum, entry) => sum + entry.strength, 0) / scored.length)
      : 0,
    // Primero el más flojo: es el que necesita el empujón, no el que ya anda.
    pendingHabits: pending
      .sort((a, b) => a.strength - b.strength)
      .map((entry) => ({
        id: entry.habit.id,
        name: entry.habit.name,
        icon: entry.habit.icon,
        anchor: entry.habit.anchor ?? null,
        strength: entry.strength,
      })),
  };
}

export function loadOfWeek<T extends DayTask>(tasks: T[], today: string): WeekLoad {
  const days = weekDaysOf(today).map((day) => ({
    day,
    count: scheduledOn(tasks, day).length,
    isToday: day === today,
  }));
  const total = days.reduce((sum, entry) => sum + entry.count, 0);
  const top = days.reduce((max, entry) => (entry.count > max.count ? entry : max), days[0]);
  return { days, total, busiest: top.count > 0 ? top.day : null };
}

export function summarizeOrganization<T extends DayTask>(
  tasks: T[],
  habits: HabitLike[],
  today: string,
): OrganizationSummary {
  const active = tasks.filter(isOpen);
  return {
    today: countToday(active, today),
    habits: summarizeHabits(habits, today),
    week: loadOfWeek(active, today),
    inbox: inboxOf(active).length,
    someday: tasks.filter((task) => task.someday && !task.done && task.status !== "DROPPED").length,
    // Vale tanto lo agendado para hoy como lo que se cerró hoy sin agendar:
    // contar sólo lo primero castiga justo los días en que uno improvisa.
    doneToday: tasks.filter(
      (task) => task.done && (task.scheduledStart ? argDay(task.scheduledStart) === today : false),
    ).length,
  };
}

/** Cuántas de las tareas del día tienen bloque horario reservado. */
export function timedShare<T extends DayTask>(tasks: T[], day: string): number {
  const ofDay = scheduledOn(tasks, day);
  if (!ofDay.length) return 0;
  return Math.round((ofDay.filter(hasTime).length / ofDay.length) * 100);
}
