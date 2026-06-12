// ─── Cálculo de racha (días consecutivos registrando) — función pura ───
// Separada para poder testearla sin tocar la DB.

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
