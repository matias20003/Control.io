import { prisma } from "@/lib/prisma";

export type ProactiveInsight = {
  key: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
};

type TxRow = {
  amount: number;
  description: string | null;
  category: string | null;
  date: Date;
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function money(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(value);
}

function merchant(value: string | null): string {
  return (value ?? "Gasto").toLowerCase().replace(/\d+/g, "").replace(/\s+/g, " ").trim();
}

export function detectFinancialInsights(rows: TxRow[], now = new Date()): ProactiveInsight[] {
  if (rows.length < 3) return [];
  const insights: ProactiveInsight[] = [];
  const expenses = rows.filter((row) => row.amount > 0);

  const historical = expenses.filter((row) => now.getTime() - row.date.getTime() > 24 * 60 * 60 * 1000);
  const latest = expenses.filter((row) => now.getTime() - row.date.getTime() <= 24 * 60 * 60 * 1000);
  const baseline = median(historical.map((row) => row.amount));
  const anomaly = latest.sort((a, b) => b.amount - a.amount)
    .find((row) => baseline > 0 && row.amount >= Math.max(15_000, baseline * 2.5));
  if (anomaly) {
    insights.push({
      key: `anomaly:${anomaly.date.toISOString()}:${anomaly.amount}`,
      severity: "warning",
      title: "Gasto fuera de lo habitual",
      message: `${anomaly.description ?? "Un gasto"} fue de *${money(anomaly.amount)}*, bastante por encima de tu gasto típico de *${money(baseline)}*.`,
    });
  }

  const byMerchant = new Map<string, TxRow[]>();
  for (const row of expenses) {
    const key = merchant(row.description);
    if (key.length < 3) continue;
    byMerchant.set(key, [...(byMerchant.get(key) ?? []), row]);
  }
  for (const [name, items] of byMerchant) {
    if (items.length < 3) continue;
    const sorted = [...items].sort((a, b) => a.date.getTime() - b.date.getTime());
    const gaps = sorted.slice(1).map((item, index) =>
      (item.date.getTime() - sorted[index].date.getTime()) / 86_400_000);
    const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const amounts = sorted.map((item) => item.amount);
    const avg = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const stable = amounts.every((amount) => Math.abs(amount - avg) / avg < 0.25);
    if (averageGap >= 20 && averageGap <= 40 && stable) {
      insights.push({
        key: `recurring:${name}`,
        severity: "info",
        title: "Posible suscripción detectada",
        message: `*${name}* aparece aproximadamente cada mes por *${money(avg)}*. Podría ser un gasto recurrente.`,
      });
      break;
    }
  }

  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const current = expenses.filter((row) => row.date >= currentStart);
  const previous = expenses.filter((row) => row.date >= previousStart && row.date < currentStart);
  const currentTotal = current.reduce((sum, row) => sum + row.amount, 0);
  const previousComparable = previous
    .filter((row) => row.date.getDate() <= now.getDate())
    .reduce((sum, row) => sum + row.amount, 0);
  if (previousComparable > 0 && currentTotal > previousComparable * 1.25) {
    const pct = Math.round((currentTotal / previousComparable - 1) * 100);
    insights.push({
      key: `pace:${now.toISOString().slice(0, 7)}`,
      severity: pct >= 50 ? "critical" : "warning",
      title: "Ritmo de gasto elevado",
      message: `A esta altura del mes llevás *${pct}% más* de gastos que el mes pasado.`,
    });
  }
  return insights.slice(0, 3);
}

export async function getProactiveInsights(userId: string): Promise<ProactiveInsight[]> {
  const since = new Date(Date.now() - 95 * 86_400_000);
  const rows = await prisma.transaction.findMany({
    where: { userId, type: "EXPENSE", date: { gte: since } },
    orderBy: { date: "desc" },
    take: 500,
    select: { amountARS: true, amount: true, currency: true, description: true, date: true, category: { select: { name: true } } },
  });
  return detectFinancialInsights(rows.map((row) => ({
    amount: Number(row.amountARS ?? (row.currency === "ARS" ? row.amount : 0)),
    description: row.description,
    category: row.category?.name ?? null,
    date: row.date,
  })).filter((row) => row.amount > 0));
}

/** Reserva un insight para que no se envíe dos veces por canales proactivos. */
export async function claimInsightDelivery(userId: string, insight: ProactiveInsight): Promise<boolean> {
  const inserted = await prisma.$executeRaw`
    INSERT INTO "whatsapp_insight_deliveries" (user_id, insight_key, severity)
    VALUES (${userId}, ${insight.key}, ${insight.severity})
    ON CONFLICT (user_id, insight_key) DO NOTHING`;
  return inserted > 0;
}
