/**
 * Reparte el material de un examen entre los días que faltan.
 *
 * El problema que resuelve es el que ningún planner en español resuelve: no
 * "cuándo estudio" sino "cuánto de esto entra en cada día que me queda". Es
 * aritmética de calendario y de minutos; no toca la base ni el reloj, así que
 * se puede probar sin fingir el tiempo.
 *
 * Dos decisiones que definen el resultado:
 *
 * 1. **Se reparte por tiempo, no por cantidad.** Repartir "seis unidades en
 *    tres días" ignora que una unidad puede llevar el triple que otra, y el
 *    plan se cae el primer día. Cada pieza declara sus minutos.
 *
 * 2. **Los últimos días son para repasar.** Llegar al examen habiendo visto
 *    todo una sola vez, con lo primero visto hace tres semanas, es la forma más
 *    común de estudiar mucho y rendir mal.
 */

export type PlanItem = {
  id: string;
  title: string;
  minutes: number;
  /** 1 = accesorio, 2 = normal, 3 = clave. Lo importante se ubica primero. */
  weight: number;
  position: number;
  done: boolean;
  isReview: boolean;
};

export type PlanConfig = {
  /** Minutos disponibles por día de la semana. Índice 0 = domingo. */
  minutesPerDay: number[];
  /** Cuántos días antes del examen se reservan sólo para repasar. */
  reviewDays: number;
};

export type ScheduledItem = PlanItem & { scheduledFor: string | null };

export type Schedule = {
  items: ScheduledItem[];
  /** Días con material asignado, en orden. */
  days: { day: string; minutes: number; items: ScheduledItem[] }[];
  /** Lo que no entró en el tiempo disponible. Se dice, no se esconde. */
  overflow: ScheduledItem[];
  /** Minutos que faltan para que entre todo. 0 si entra. */
  missingMinutes: number;
};

const DAY_MS = 86_400_000;

export function addDays(day: string, days: number): string {
  return new Date(new Date(`${day}T00:00:00.000Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Días desde `from` hasta `to`, ambos incluidos. */
export function daysBetween(from: string, to: string): string[] {
  if (to < from) return [];
  const out: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) out.push(day);
  return out;
}

function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00.000Z`).getUTCDay();
}

/** Minutos disponibles ese día según la configuración semanal. */
export function capacityOf(day: string, config: PlanConfig): number {
  return Math.max(0, config.minutesPerDay[weekdayOf(day)] ?? 0);
}

/**
 * Lo importante primero y, a igual peso, el orden del programa. Estudiar en el
 * orden del programa es lo natural, pero cuando el tiempo no alcanza lo que
 * tiene que sobrevivir es lo que más pesa en el examen.
 */
function studyOrder(a: PlanItem, b: PlanItem): number {
  if (a.weight !== b.weight) return b.weight - a.weight;
  return a.position - b.position;
}

/**
 * Arma el cronograma.
 *
 * @param items      Material a repartir. Lo ya hecho no se reprograma.
 * @param from       Primer día disponible (normalmente hoy).
 * @param examDay    Día del examen. No se estudia ese día: se rinde.
 */
export function buildSchedule(
  items: PlanItem[],
  from: string,
  examDay: string,
  config: PlanConfig,
): Schedule {
  // El día del examen no cuenta como día de estudio.
  const allDays = daysBetween(from, addDays(examDay, -1));
  const pending = items.filter((item) => !item.done).sort(studyOrder);
  const doneItems: ScheduledItem[] = items
    .filter((item) => item.done)
    .map((item) => ({ ...item, scheduledFor: null }));

  // Los últimos días quedan para repaso: el material nuevo entra antes.
  const reviewCount = Math.min(config.reviewDays, Math.max(0, allDays.length - 1));
  const studyDays = allDays.slice(0, allDays.length - reviewCount);
  const reviewDaysList = allDays.slice(allDays.length - reviewCount);

  const scheduled: ScheduledItem[] = [];
  const overflow: ScheduledItem[] = [];

  // Reparto codicioso por día: se llena un día hasta donde da y se sigue. Es lo
  // que hace un humano con un cronograma en papel, y tiene la ventaja de que si
  // el plan se corta, lo que quedó afuera es lo menos importante.
  let dayIndex = 0;
  let usedInDay = 0;
  const nuevos = pending.filter((item) => !item.isReview);

  for (const item of nuevos) {
    let placed = false;
    while (dayIndex < studyDays.length) {
      const day = studyDays[dayIndex];
      const capacity = capacityOf(day, config);
      if (capacity === 0) { dayIndex++; usedInDay = 0; continue; }
      if (usedInDay + item.minutes <= capacity) {
        scheduled.push({ ...item, scheduledFor: day });
        usedInDay += item.minutes;
        placed = true;
        break;
      }
      // No entra en lo que queda del día: se pasa al siguiente. Si tampoco
      // entra en un día entero, se acepta igual para no dejarlo sin fecha.
      if (usedInDay === 0 && item.minutes > capacity) {
        scheduled.push({ ...item, scheduledFor: day });
        dayIndex++;
        usedInDay = 0;
        placed = true;
        break;
      }
      dayIndex++;
      usedInDay = 0;
    }
    if (!placed) overflow.push({ ...item, scheduledFor: null });
  }

  // Los repasos se reparten en los días reservados, parejo.
  const repasos = pending.filter((item) => item.isReview);
  if (reviewDaysList.length > 0) {
    repasos.forEach((item, index) => {
      scheduled.push({ ...item, scheduledFor: reviewDaysList[index % reviewDaysList.length] });
    });
  } else {
    for (const item of repasos) overflow.push({ ...item, scheduledFor: null });
  }

  const byDay = new Map<string, ScheduledItem[]>();
  for (const item of scheduled) {
    if (!item.scheduledFor) continue;
    byDay.set(item.scheduledFor, [...(byDay.get(item.scheduledFor) ?? []), item]);
  }

  return {
    items: [...scheduled, ...overflow, ...doneItems],
    days: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, dayItems]) => ({
        day,
        minutes: dayItems.reduce((sum, item) => sum + item.minutes, 0),
        items: dayItems,
      })),
    overflow,
    missingMinutes: overflow.reduce((sum, item) => sum + item.minutes, 0),
  };
}

/**
 * Rehace el plan desde hoy con lo que quedó sin hacer.
 *
 * Es la función que la gente cita como la razón para quedarse en el único
 * producto que validó esta idea, y el motivo es simple: todo el mundo se
 * atrasa, y un plan que no se puede reacomodar se abandona el primer día que
 * no se cumple. Lo hecho no se toca; lo pendiente se vuelve a repartir en el
 * tiempo que de verdad queda.
 */
export function rebalance(
  items: PlanItem[],
  today: string,
  examDay: string,
  config: PlanConfig,
): Schedule {
  return buildSchedule(items, today, examDay, config);
}

/** Cuánto tiempo hace falta y cuánto hay: la cuenta honesta antes de empezar. */
export function feasibility(items: PlanItem[], from: string, examDay: string, config: PlanConfig) {
  const needed = items.filter((item) => !item.done).reduce((sum, item) => sum + item.minutes, 0);
  const available = daysBetween(from, addDays(examDay, -1))
    .reduce((sum, day) => sum + capacityOf(day, config), 0);
  return {
    neededMinutes: needed,
    availableMinutes: available,
    fits: needed <= available,
    /**
     * Cuántos minutos por día harían falta para que entre, contando sólo los
     * días en los que declaraste tener tiempo. Repartirlo entre todos los días
     * del rango daría un número más bajo y más falso: los domingos en que no
     * estudiás no ayudan a llegar al parcial.
     */
    minutesPerDayNeeded: (() => {
      const usable = daysBetween(from, addDays(examDay, -1)).filter((day) => capacityOf(day, config) > 0);
      return usable.length > 0 ? Math.ceil(needed / usable.length) : needed;
    })(),
  };
}
