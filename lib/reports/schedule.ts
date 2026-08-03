import type { ReportFrequency } from "@/lib/reports/periodic";

/**
 * Cuándo le toca a cada reporte periódico.
 *
 * Lógica pura y sin acceso a datos, para poder testearla: es la que decide si
 * el reporte sale hoy, y equivocarse acá significa mandarlo el día que no es o
 * saltear un mes entero.
 *
 * `now` tiene que llegar ya convertido a hora argentina (toZonedTime), así que
 * los getters locales de Date son los correctos.
 */
export function isReportDue(
  frequency: ReportFrequency,
  configuredDay: number | null,
  now: Date,
): boolean {
  const day = configuredDay ?? 1;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Semanal: el día de la semana elegido (0=domingo … 6=sábado).
  if (frequency === "WEEKLY") return now.getDay() === day;

  // Quincenal: dos veces por mes. Si eligió 15 va el 15 y el último día del mes;
  // si no, va el 1 y el 16.
  if (frequency === "FORTNIGHTLY") {
    return day === 15
      ? now.getDate() === 15 || now.getDate() === lastDayOfMonth
      : now.getDate() === 1 || now.getDate() === 16;
  }

  // Mensual: el día elegido, recortado al último día en meses cortos, para que
  // un 31 no se saltee febrero.
  return now.getDate() === Math.min(day, lastDayOfMonth);
}
