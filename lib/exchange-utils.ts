// ─── Funciones puras de conversión de moneda (sin dependencias de servidor) ───
// Separadas de lib/exchange.ts (que importa prisma) para poder testearlas.

/**
 * Promedio compra/venta del dólar blue, tolerando que falte una de las puntas.
 * - ambas <= 0  → null (no hay cotización usable)
 * - una <= 0    → devuelve la otra
 * - ambas > 0   → promedio (buy + sell) / 2
 */
export function averageRate(buy: number, sell: number): number | null {
  if (buy <= 0 && sell <= 0) return null;
  if (buy <= 0) return sell;
  if (sell <= 0) return buy;
  return (buy + sell) / 2;
}

/**
 * Convierte un monto a ARS dado su moneda y el tipo de cambio.
 * - ARS  → rate = 1, amountARS = amount.
 * - USD  → si hay rate, amountARS = amount * rate; si no, null.
 * - otra → null (no soportamos otras conversiones por ahora).
 */
export function amountToArs(
  amount: number,
  currency: string,
  rate: number | null
): { amountARS: number | null; exchangeRate: number | null } {
  if (currency === "ARS") return { amountARS: amount, exchangeRate: 1 };
  if (currency === "USD") {
    if (!rate) return { amountARS: null, exchangeRate: null };
    return { amountARS: amount * rate, exchangeRate: rate };
  }
  return { amountARS: null, exchangeRate: null };
}
