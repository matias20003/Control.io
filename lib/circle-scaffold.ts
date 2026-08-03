/**
 * Mi Círculo · el andamio.
 *
 * La sección SÍ busca generar dopamina: la diferencia con Instagram no está en
 * la maquinaria sino en QUÉ la dispara. Acá dispara al convertir una lectura en
 * algo, al declarar una conversación real y al cerrar la ración — actos que
 * tienen fondo. Nunca al consumir, porque premiar consumo no tiene techo y eso
 * es exactamente el feed del que la persona se está yendo.
 *
 * La decisión de producto que gobierna este archivo: **la capa fabricada es un
 * andamio, no un cimiento.** El día 1 no hay nada real que reflejar, así que la
 * maquinaria carga sola las primeras semanas. A medida que se acumulan
 * conversaciones que ocurrieron y hábitos que siguen en pie, el espejo pesa más
 * que cualquier animación y la maquinaria baja el volumen. El retiro es
 * declarado: la app lo dice en voz alta en vez de apagarse de a poco.
 *
 * Puro y determinista: se le pasa el "hoy", no lee el reloj.
 */

import { startOfDayArg } from "./timezone";

const DAY_MS = 86_400_000;

export type ScaffoldPhase = "ANDAMIO" | "TRANSICION" | "RETIRO";

/** Meses cumplidos a partir de los cuales empieza cada fase. */
export const TRANSITION_MONTH = 3;
export const RETIREMENT_MONTH = 6;

export const PHASE_LABELS: Record<ScaffoldPhase, string> = {
  ANDAMIO: "Andamio",
  TRANSICION: "Bajando el volumen",
  RETIRO: "Retirado",
};

export type ScaffoldDose = {
  phase: ScaffoldPhase;
  /** Meses cumplidos desde que se miró al espejo por primera vez. */
  monthsIn: number;
  /** 0–100. Cuánta maquinaria fabricada se muestra. Sólo para explicarlo. */
  intensity: number;
  /** Celebrar cada conversión con toda la pantalla. */
  fullCelebration: boolean;
  /** Mostrar la racha semanal. */
  showStreak: boolean;
  /** Anunciar de antemano que la edición de hoy trae algo (anticipación). */
  announce: boolean;
  /** El espejo pasa adelante y la maquinaria queda atrás. */
  mirrorFirst: boolean;
};

/** Meses cumplidos entre dos fechas, sin depender de la duración del mes. */
function monthsBetween(from: Date, to: Date): number {
  const meses =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  const cumplió = to.getDate() >= from.getDate();
  return Math.max(0, cumplió ? meses : meses - 1);
}

/**
 * Cuánta maquinaria corresponde hoy.
 *
 * `startedAt` es el día que la persona se miró al espejo (subió su inventario);
 * si nunca lo hizo, la fecha en que empezó a usar la sección. Sin fecha, se
 * asume el arranque: alguien recién llegado necesita el andamio entero.
 */
export function scaffoldDose(startedAt: Date | null, today: Date): ScaffoldDose {
  const monthsIn = startedAt ? monthsBetween(startedAt, today) : 0;

  if (monthsIn >= RETIREMENT_MONTH) {
    return {
      phase: "RETIRO",
      monthsIn,
      intensity: 20,
      fullCelebration: false,
      showStreak: false,
      announce: true,
      mirrorFirst: true,
    };
  }

  if (monthsIn >= TRANSITION_MONTH) {
    return {
      phase: "TRANSICION",
      monthsIn,
      intensity: 60,
      fullCelebration: false,
      showStreak: true,
      announce: true,
      mirrorFirst: false,
    };
  }

  return {
    phase: "ANDAMIO",
    monthsIn,
    intensity: 100,
    fullCelebration: true,
    showStreak: true,
    announce: true,
    mirrorFirst: false,
  };
}

/**
 * Lo que la app dice sobre sí misma en cada fase. El contrato del minuto cero
 * es lo que hace que el retiro se lea como una promesa cumplida y no como que
 * la app te abandona; por eso el texto existe desde el principio y no aparece
 * recién al final.
 */
export function scaffoldNotice(dose: ScaffoldDose): { title: string; body: string } {
  if (dose.phase === "RETIRO") {
    return {
      title: "Ya no te necesito para engancharte",
      body:
        "Durante los primeros meses usé las mismas armas que Instagram: celebraciones, rachas, avisos. Era un andamio. Lo que juntaste desde entonces ya se sostiene solo, así que las voy guardando.",
    };
  }
  if (dose.phase === "TRANSICION") {
    return {
      title: "Empiezo a bajar el volumen",
      body:
        "Ya tenés historia propia acá. Desde ahora la app festeja menos y muestra más lo que realmente pasó.",
    };
  }
  return {
    title: "Te voy a enganchar a propósito",
    body:
      "Los primeros meses uso la misma maquinaria que las redes: celebro lo que convertís, te muestro rachas y te aviso cuando hay algo bueno. La diferencia es qué premio — nunca cuánto consumís — y que la meta es dejar de hacerlo.",
  };
}

// ─── La racha, en versión honesta ────────────────────────────────────────────

/**
 * Actos valiosos por semana que sostienen la racha.
 *
 * La racha NO cuenta días seguidos abriendo la app: eso premiaría la apertura,
 * que es consumo, y además chocaría de frente con que la app pueda decir "hoy
 * no hay nada que valga tu tiempo" — un día honesto te rompería la racha, o sea
 * que la app tendría que mentirte para no romperla. Contando actos por semana,
 * un día vacío no cuesta nada.
 */
export const WEEKLY_ACTS_GOAL = 3;

export type Streak = {
  /** Semanas consecutivas cerradas que llegaron al objetivo. */
  weeks: number;
  /** Actos de la semana en curso. */
  thisWeek: number;
  /** Le falta para asegurar la semana en curso. 0 = ya está. */
  missing: number;
};

/** Lunes 00:00 (hora argentina) de la semana de `date`. */
function startOfWeekArg(date: Date): Date {
  const day = startOfDayArg(date);
  // Argentina no tiene horario de verano: la medianoche ARG siempre cae 03:00
  // UTC, así que el día de la semana en UTC del instante ya es el argentino.
  // Leerlo con getDay() daría el del server, que en Vercel corre en UTC.
  const offset = (day.getUTCDay() + 6) % 7; // 0 = domingo → la semana arranca el lunes
  return new Date(day.getTime() - offset * DAY_MS);
}

/**
 * La racha a partir de las fechas de los actos valiosos (conversiones,
 * conversaciones declaradas, cierres, podas).
 *
 * La semana en curso nunca rompe la racha: todavía está corriendo. Sólo se
 * cuentan semanas ya cerradas, hacia atrás, hasta la primera que no llegó.
 */
export function weeklyStreak(actDates: Date[], today: Date): Streak {
  const thisWeekStart = startOfWeekArg(today);
  const porSemana = new Map<number, number>();

  for (const date of actDates) {
    const key = startOfWeekArg(date).getTime();
    porSemana.set(key, (porSemana.get(key) ?? 0) + 1);
  }

  const thisWeek = porSemana.get(thisWeekStart.getTime()) ?? 0;

  let weeks = 0;
  // Arranca en la semana pasada: la actual todavía no se puede juzgar.
  for (let cursor = thisWeekStart.getTime() - 7 * DAY_MS; ; cursor -= 7 * DAY_MS) {
    if ((porSemana.get(cursor) ?? 0) < WEEKLY_ACTS_GOAL) break;
    weeks += 1;
    // Cortafuegos: sin actos más viejos no hay nada que seguir contando.
    if (weeks > 520) break;
  }

  // La semana en curso, si ya llegó al objetivo, cuenta como ganada.
  if (thisWeek >= WEEKLY_ACTS_GOAL) weeks += 1;

  return {
    weeks,
    thisWeek,
    missing: Math.max(0, WEEKLY_ACTS_GOAL - thisWeek),
  };
}

/** "3 semanas seguidas" — el texto de la racha, sin inflarlo. */
export function streakLabel(streak: Streak): string | null {
  if (streak.weeks <= 0) return null;
  return streak.weeks === 1 ? "1 semana seguida" : `${streak.weeks} semanas seguidas`;
}
