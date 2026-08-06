/**
 * Constancia de un hábito a partir de sus días completados.
 *
 * Los días son claves "YYYY-MM-DD" ya expresadas en hora argentina, así que acá
 * no hay zonas horarias: es aritmética de calendario sobre strings.
 */

export type HabitSchedule = {
  frequency: string;
  /** 0=Domingo … 6=Sábado, igual que Date.getDay(). Vacío = todos los días. */
  daysOfWeek: number[];
};

const DAY_MS = 86_400_000;

function toDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDay(day: string, days: number): string {
  return toKey(new Date(toDate(day).getTime() + days * DAY_MS));
}

/** ¿El hábito toca ese día según su frecuencia? */
export function isHabitDue(day: string, schedule: HabitSchedule): boolean {
  if (schedule.frequency === "DAILY") return true;
  if (!schedule.daysOfWeek?.length) return true;
  return schedule.daysOfWeek.includes(toDate(day).getUTCDay());
}

export type HabitStreak = {
  /** Días que toca cumplir seguidos hasta hoy. */
  current: number;
  /** La racha más larga que consiguió alguna vez. */
  best: number;
  /** % de días que tocaba y cumplió en la ventana pedida. */
  rate: number;
  /**
   * Qué tan afirmado está el hábito, de 0 a 100. Sube con cada cumplimiento y
   * baja con cada día que tocaba y no fue, pero nunca se desploma: faltar un
   * día lo baja unos puntos, no lo vuelve a cero.
   */
  strength: number;
  doneToday: boolean;
  dueToday: boolean;
};

/**
 * Cuánto pesa el día más reciente frente a todo el historial. 0.12 deja una
 * vida media de unos seis días que tocan: suficiente para que un buen tramo se
 * note enseguida, y para que una semana floja se recupere sin drama.
 */
const STRENGTH_ALPHA = 0.12;

/**
 * Fuerza del hábito como media móvil exponencial sobre los días que tocaban.
 *
 * Reemplaza a la racha como medida principal por una razón concreta: el estudio
 * de referencia sobre formación de hábitos (Lally, 2010) midió que saltear una
 * oportunidad no afecta materialmente el proceso. Una racha que vuelve a cero
 * castiga con la pérdida total de lo acumulado un evento que, según la
 * evidencia, no cambia nada — y ese castigo es lo que hace que la gente
 * abandone. Un puntaje que decae dice la verdad sin romper nada.
 */
export function habitStrength(
  schedule: HabitSchedule,
  completedDays: string[],
  today: string,
  windowDays = 120,
): number {
  const done = new Set(completedDays);
  let score = 0;
  let seen = false;
  for (let i = windowDays - 1; i >= 0; i--) {
    const day = shiftDay(today, -i);
    if (!isHabitDue(day, schedule)) continue;
    // El día de hoy todavía está en curso: no cuenta como falta hasta mañana.
    if (day === today && !done.has(day)) continue;
    score = score * (1 - STRENGTH_ALPHA) + (done.has(day) ? 100 : 0) * STRENGTH_ALPHA;
    seen = true;
  }
  return seen ? Math.round(score) : 0;
}

export function getHabitStreak(
  schedule: HabitSchedule,
  completedDays: string[],
  today: string,
  rateWindowDays = 30,
): HabitStreak {
  const done = new Set(completedDays);
  const dueToday = isHabitDue(today, schedule);
  const doneToday = done.has(today);

  // Racha actual. Si hoy toca y todavía no se marcó, la racha no se corta: el
  // día está en curso, así que se empieza a contar desde ayer.
  let current = 0;
  let cursor = dueToday && !doneToday ? shiftDay(today, -1) : today;
  for (let guard = 0; guard < 3650; guard++) {
    if (!isHabitDue(cursor, schedule)) {
      cursor = shiftDay(cursor, -1);
      continue;
    }
    if (!done.has(cursor)) break;
    current++;
    cursor = shiftDay(cursor, -1);
  }

  // Mejor racha: recorremos desde el primer día cumplido hasta hoy.
  let best = 0;
  if (completedDays.length) {
    const earliest = completedDays.reduce((min, day) => (day < min ? day : min), completedDays[0]);
    let run = 0;
    let day = earliest;
    for (let guard = 0; guard < 3650 && day <= today; guard++) {
      if (isHabitDue(day, schedule)) {
        if (done.has(day)) {
          run++;
          if (run > best) best = run;
        } else if (day !== today) {
          // El día de hoy sin marcar todavía no rompe nada.
          run = 0;
        }
      }
      day = shiftDay(day, 1);
    }
  }

  // Cumplimiento sobre los días que efectivamente tocaban en la ventana.
  let due = 0;
  let hits = 0;
  for (let i = 0; i < rateWindowDays; i++) {
    const day = shiftDay(today, -i);
    if (!isHabitDue(day, schedule)) continue;
    due++;
    if (done.has(day)) hits++;
  }

  return {
    current,
    best: Math.max(best, current),
    rate: due ? Math.round((hits / due) * 100) : 0,
    strength: habitStrength(schedule, completedDays, today),
    doneToday,
    dueToday,
  };
}
