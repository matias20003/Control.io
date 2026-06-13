// ─── Cálculo de racha (días consecutivos registrando) — función pura ───
// Separada para poder testearla sin tocar la DB.

/** Hitos de racha que se celebran (Hooked: recompensa por constancia). */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

/** Próximo hito por encima de la racha actual (null si ya superó todos). */
export function nextStreakMilestone(current: number): number | null {
  return STREAK_MILESTONES.find((m) => m > current) ?? null;
}

/** True si N es exactamente un hito celebrable. */
export function isStreakMilestone(n: number): boolean {
  return STREAK_MILESTONES.includes(n);
}

/** Racha más larga histórica (récord): máxima corrida de días consecutivos. */
export function calculateLongestStreak(activeDays: Set<string>): number {
  if (activeDays.size === 0) return 0;
  const sorted = [...activeDays].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${sorted[i]}T00:00:00Z`).getTime();
    if (Math.round((cur - prev) / 86_400_000) === 1) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

/**
 * Racha actual: cantidad de días ARG consecutivos con al menos un movimiento,
 * terminando HOY o AYER. La racha sigue "viva" si cargaste ayer aunque hoy
 * todavía no hayas cargado (tenés hasta fin del día para mantenerla).
 *
 * @param activeDays Set de fechas "YYYY-MM-DD" (ARG) que tienen movimientos.
 * @param today      "YYYY-MM-DD" de hoy en ARG.
 */
export function calculateStreak(activeDays: Set<string>, today: string): number {
  if (activeDays.size === 0) return 0;

  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const cursor = new Date(`${today}T00:00:00Z`);

  // Si hoy no hay movimiento, la racha puede seguir viva desde ayer.
  if (!activeDays.has(ymd(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!activeDays.has(ymd(cursor))) return 0; // ni hoy ni ayer → rota
  }

  let streak = 0;
  while (activeDays.has(ymd(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
