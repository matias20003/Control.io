import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Backfill de amountARS y exchangeRate para transacciones existentes que
 * fueron creadas antes de que el sistema empezara a guardar la conversión.
 *
 * Reglas:
 * - currency = "ARS"  → amountARS = amount, exchangeRate = 1.
 * - currency = "USD"  → usa el rate "blue" más cercano (en fecha) a la
 *   transacción, calculado como (compra + venta) / 2.
 * - otra currency     → se deja en null (no podemos inferir).
 *
 * Idempotente: solo procesa filas con amountARS == null.
 * Admin-only: requiere usuario logueado con email == ADMIN_EMAIL.
 */

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  // Pre-cargo los rates "blue" históricos en memoria para no hacer una query
  // por cada transacción.
  const blueRates = await prisma.exchangeRate.findMany({
    where: { currency: "USD", type: "blue" },
    orderBy: { fetchedAt: "asc" },
    select: { fetchedAt: true, buyRate: true, sellRate: true },
  });

  function rateAt(date: Date): number | null {
    if (!blueRates.length) return null;
    // Buscar el más cercano en fecha (linear search, ok para algunos cientos
    // de muestras de cotización en un proyecto típico).
    let best = blueRates[0];
    let bestDiff = Math.abs(date.getTime() - best.fetchedAt.getTime());
    for (const r of blueRates) {
      const diff = Math.abs(date.getTime() - r.fetchedAt.getTime());
      if (diff < bestDiff) { best = r; bestDiff = diff; }
    }
    const buy = toNum(best.buyRate);
    const sell = toNum(best.sellRate);
    if (buy <= 0 && sell <= 0) return null;
    if (buy <= 0)  return sell;
    if (sell <= 0) return buy;
    return (buy + sell) / 2;
  }

  // Procesamos en batches para no agotar memoria con cuentas enormes.
  const BATCH = 200;
  let cursor: string | undefined;
  let updatedARS = 0;
  let updatedUSD = 0;
  let skippedNoRate = 0;
  let skippedOther = 0;

  // Solo filas pendientes.
  while (true) {
    const rows: Array<{ id: string; amount: any; currency: string; date: Date }> = await prisma.transaction.findMany({
      where: { amountARS: null },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, amount: true, currency: true, date: true },
    });
    if (!rows.length) break;

    for (const row of rows) {
      const amount = toNum(row.amount);
      if (row.currency === "ARS") {
        await prisma.transaction.update({
          where: { id: row.id },
          data: { amountARS: amount, exchangeRate: 1 },
        });
        updatedARS++;
      } else if (row.currency === "USD") {
        const rate = rateAt(row.date);
        if (rate == null) {
          skippedNoRate++;
          continue;
        }
        await prisma.transaction.update({
          where: { id: row.id },
          data: { amountARS: amount * rate, exchangeRate: rate },
        });
        updatedUSD++;
      } else {
        skippedOther++;
      }
    }

    cursor = rows[rows.length - 1].id;
    if (rows.length < BATCH) break;
  }

  const total = updatedARS + updatedUSD;
  return Response.json({
    ok: true,
    total,
    detail: {
      updatedARS,
      updatedUSD,
      skippedNoRate,
      skippedOther,
    },
    message: total > 0
      ? `Backfill completado: ${updatedARS} en ARS, ${updatedUSD} en USD. ${skippedNoRate} USD quedaron sin rate (sin cotización histórica), ${skippedOther} en otras monedas no soportadas.`
      : "Nada que migrar: todas las transacciones ya tenían amountARS.",
  });
}
