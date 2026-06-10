/**
 * Snapshot del tipo de cambio para convertir monedas no-ARS a ARS al momento
 * de crear/actualizar un movimiento. Usamos el último blue cacheado (promedio
 * compra/venta) porque es el referente real para gastos personales en
 * Argentina.
 *
 * Si no hay cotización disponible (BD vacía, fetch falló), devolvemos null y
 * el caller decide qué hacer (típicamente: no calcular amountARS y que el
 * usuario lo vea como N/A en los reportes de ARS).
 */
import { prisma } from "@/lib/prisma";
import { averageRate, amountToArs } from "@/lib/exchange-utils";

export { averageRate, amountToArs };

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

export async function getUsdToArsRate(): Promise<number | null> {
  const blue = await prisma.exchangeRate.findFirst({
    where: { currency: "USD", type: "blue" },
    orderBy: { fetchedAt: "desc" },
  });
  if (!blue) return null;
  return averageRate(toNum(blue.buyRate), toNum(blue.sellRate));
}

/**
 * Devuelve { amountARS, exchangeRate } para guardar junto a una Transaction.
 * - currency = "ARS"  → rate=1, amountARS = amount.
 * - currency = "USD"  → rate = blue promedio (si hay cache), si no null.
 * - currency = otra   → null (no soportamos otras conversiones por ahora).
 */
export async function snapshotConversion(
  amount: number,
  currency: string,
): Promise<{ amountARS: number | null; exchangeRate: number | null }> {
  const rate = currency === "USD" ? await getUsdToArsRate() : null;
  return amountToArs(amount, currency, rate);
}
