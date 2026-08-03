/**
 * Período y tope de la búsqueda de movimientos.
 *
 * Módulo puro, sin prisma: lo usan los dos lados. El server para recortar la
 * consulta y el cliente para avisar cuando el total que muestra es parcial.
 */

/** Tope de resultados que devuelve una búsqueda. */
export const SEARCH_RESULT_LIMIT = 200;

/** Ventana de la búsqueda, en días calendario ("YYYY-MM-DD"). */
export type SearchRange = { from?: string; to?: string };

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Deja el rango en condiciones de usar.
 *
 * Descarta lo que no sea un día completo — el usuario está tipeando y el input
 * pasa por estados incompletos, que no tienen que romper la búsqueda — y da
 * vuelta el rango invertido, que si no jamás devolvería un resultado.
 */
export function normalizeSearchRange(range?: SearchRange): SearchRange {
  const from = range?.from && DAY_PATTERN.test(range.from) ? range.from : undefined;
  const to = range?.to && DAY_PATTERN.test(range.to) ? range.to : undefined;
  if (from && to && from > to) return { from: to, to: from };
  return { from, to };
}

/**
 * Bordes de la ventana como instantes.
 *
 * En UTC a propósito: las fechas de los movimientos se guardan como medianoche
 * UTC del día que eligió el usuario, así que armar los bordes en hora local
 * correría el rango un día en cualquier server que no corra en UTC.
 *
 * Sin `from` la ventana son los últimos 6 meses, que es el default histórico de
 * la búsqueda.
 */
export function searchWindow(
  range: SearchRange,
  now: Date = new Date()
): { since: Date; until: Date | null } {
  let since: Date;
  if (range.from) {
    since = new Date(`${range.from}T00:00:00.000Z`);
  } else {
    since = new Date(now);
    since.setMonth(since.getMonth() - 6);
  }
  const until = range.to ? new Date(`${range.to}T23:59:59.999Z`) : null;
  return { since, until };
}
