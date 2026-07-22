// Motor de repetición espaciada (Secciones 6, 7, 8, 23, 35 del spec).

export type Mastery = "ROJO" | "AMARILLO" | "VERDE" | "CONSOLIDADO";
export type Stage = "D0" | "D+1" | "D+3" | "D+7" | "D+16" | "MANT_SEM" | "MANT_QUIN";

export const MASTERY: Mastery[] = ["ROJO", "AMARILLO", "VERDE", "CONSOLIDADO"];
export const MASTERY_LABEL: Record<Mastery, string> = {
  ROJO: "Rojo", AMARILLO: "Amarillo", VERDE: "Verde", CONSOLIDADO: "Consolidado",
};
export const IMPORTANCE_LABEL: Record<number, string> = { 1: "Baja", 2: "Media", 3: "Alta", 4: "Muy alta" };

// Secuencia y gap (días) hasta la siguiente etapa al avanzar.
const STAGE_ORDER: Stage[] = ["D0", "D+1", "D+3", "D+7", "D+16"];
const NEXT_GAP: Record<string, number> = { "D0": 1, "D+1": 2, "D+3": 4, "D+7": 9, "D+16": 7 };

function nextStage(stage: Stage): Stage {
  const i = STAGE_ORDER.indexOf(stage);
  if (i >= 0 && i < STAGE_ORDER.length - 1) return STAGE_ORDER[i + 1];
  return "MANT_SEM";
}
function prevStage(stage: Stage): Stage {
  const i = STAGE_ORDER.indexOf(stage);
  return i > 0 ? STAGE_ORDER[i - 1] : "D0";
}

/** Fecha a mediodía UTC (~9 ARG) de hoy + N días. */
function inDays(from: Date, days: number): Date {
  const d = new Date(from.getTime() + days * 86_400_000);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

export type NextReview = { nextDate: Date; nextStage: Stage; duration: number; masteryLevel: Mastery };

/**
 * Calcula la ÚNICA próxima fecha/etapa según el resultado de la sesión (Sección 35).
 * `reviewCount` se usa para no dejar CONSOLIDADO tras un solo estudio (Sección 6).
 */
export function calcularProximoRepaso(
  block: { reviewStage: Stage; importance: number; reviewDuration: number; reviewCount: number },
  result: Mastery,
  now = new Date()
): NextReview {
  const stage = block.reviewStage;

  if (result === "ROJO") {
    return { nextDate: inDays(now, 1), nextStage: stage === "D0" ? "D0" : prevStage(stage), duration: 35, masteryLevel: "ROJO" };
  }

  if (result === "AMARILLO") {
    if (stage === "D0") return { nextDate: inDays(now, 1), nextStage: "D+1", duration: 25, masteryLevel: "AMARILLO" };
    const gap = NEXT_GAP[stage] ?? 3;
    return { nextDate: inDays(now, Math.max(1, Math.ceil(gap / 2))), nextStage: stage, duration: 25, masteryLevel: "AMARILLO" };
  }

  if (result === "VERDE") {
    const ns = nextStage(stage);
    const gap = NEXT_GAP[stage] ?? 7;
    return { nextDate: inDays(now, gap), nextStage: ns, duration: Math.max(10, block.reviewDuration - 5), masteryLevel: "VERDE" };
  }

  // CONSOLIDADO — solo real si ya pasó varios repasos; sino se trata como VERDE.
  if (block.reviewCount < 2 || !["D+7", "D+16", "MANT_SEM", "MANT_QUIN"].includes(stage)) {
    const ns = nextStage(stage);
    return { nextDate: inDays(now, NEXT_GAP[stage] ?? 7), nextStage: ns, duration: Math.max(10, block.reviewDuration - 5), masteryLevel: "VERDE" };
  }
  const sem = block.importance >= 3;
  return {
    nextDate: inDays(now, sem ? 7 : 14),
    nextStage: sem ? "MANT_SEM" : "MANT_QUIN",
    duration: 15,
    masteryLevel: "CONSOLIDADO",
  };
}

/** Puntaje de prioridad para el plan diario (Sección 23). */
export function priorityScore(
  b: { masteryLevel: string; nextReviewDate: Date | null; importance: number; errorCount: number; incorporationDate: Date },
  now = new Date()
): number {
  let s = 0;
  s += b.masteryLevel === "ROJO" ? 100 : b.masteryLevel === "AMARILLO" ? 60 : b.masteryLevel === "VERDE" ? 20 : 5;
  // atraso
  if (b.nextReviewDate) {
    const overdue = Math.floor((now.getTime() - b.nextReviewDate.getTime()) / 86_400_000);
    if (overdue >= 8) s += 60; else if (overdue >= 4) s += 40; else if (overdue >= 2) s += 25; else if (overdue >= 1) s += 10;
  }
  // importancia
  s += b.importance >= 4 ? 50 : b.importance === 3 ? 30 : b.importance === 2 ? 15 : 5;
  // errores reincidentes (proxy por errorCount)
  s += b.errorCount >= 3 ? 30 : b.errorCount === 2 ? 15 : b.errorCount >= 1 ? 5 : 0;
  // antigüedad (leve)
  const ageDays = Math.floor((now.getTime() - b.incorporationDate.getTime()) / 86_400_000);
  s += Math.min(20, Math.floor(ageDays / 3));
  return s;
}

/** Disponibilidad semanal por defecto (minutos). 0=Dom … 6=Sáb. Dom = descanso. */
export const DEFAULT_AVAILABILITY: Record<number, number> = {
  0: 0, 1: 300, 2: 240, 3: 210, 4: 240, 5: 180, 6: 270,
};

/** Prioridad extra por parcial/examen cercano (Sección 15). daysToExam null = sin examen. */
export function examBoost(daysToExam: number | null): number {
  if (daysToExam == null || daysToExam < 0) return 0;
  if (daysToExam <= 2) return 80;
  if (daysToExam <= 5) return 50;
  if (daysToExam <= 10) return 30;
  if (daysToExam <= 20) return 15;
  return 5;
}

/** ¿Este día de la semana es de descanso? (0 min disponibles) */
export function isRestDay(dayOfWeek: number, availability: Record<number, number>): boolean {
  return (availability[dayOfWeek] ?? 0) <= 0;
}

/** Actividad sugerida según etapa (Sección 26 — estudio activo). */
export function suggestedActivity(stage: Stage): string {
  switch (stage) {
    case "D0": return "Estudiar y entender el tema. Anotá definiciones y fórmulas clave.";
    case "D+1": return "Recuperación activa: explicá el tema SIN mirar y escribí las fórmulas de memoria.";
    case "D+3": return "Resolvé un ejercicio SIN apuntes y explicá el procedimiento paso a paso.";
    case "D+7": return "Práctica acumulativa: mezclá con otros temas y resolvé ejercicios nuevos.";
    case "D+16": return "Mini-evaluación: comprobá que dominás el tema sin ayuda.";
    default: return "Mantenimiento: un repaso rápido para que no se enfríe.";
  }
}
