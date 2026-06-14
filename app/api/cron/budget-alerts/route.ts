import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { sendPushToUser } from "@/lib/push/send";
import { sendDailyReminders } from "@/lib/whatsapp/daily-reminder";

// Vercel Cron: diariamente a las 23:00 UTC (20:00 ARG).
// Además de las alertas de presupuesto, dispara el recordatorio diario por
// WhatsApp (consolidado acá por el límite de 2 crons del plan Hobby de Vercel).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (process.env.NODE_ENV !== "production") return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function toNum(v: unknown): number {
  if (!v) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Recordatorio diario por WhatsApp (20hs ARG). Best-effort: corre siempre,
  // aun si no hay presupuestos cargados.
  const reminder = await sendDailyReminders().catch(() => ({ sent: 0, skipped: 0, failed: 0 }));

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const dateFrom = startOfMonth(now);
  const dateTo = endOfMonth(now);

  const budgets = await prisma.budget.findMany({
    where: { month, year },
    include: { category: { select: { name: true, icon: true } } },
  });

  if (!budgets.length) return Response.json({ ok: true, alerts: 0, reminder });

  // Agrupar por userId para una sola query
  const userIds = [...new Set(budgets.map((b) => b.userId))];

  // Gastos por categoría este mes
  const txRows = await prisma.transaction.groupBy({
    by: ["userId", "categoryId"],
    where: {
      userId: { in: userIds },
      type: "EXPENSE",
      currency: "ARS",
      date: { gte: dateFrom, lte: dateTo },
      categoryId: { in: budgets.map((b) => b.categoryId) },
    },
    _sum: { amount: true },
  });

  const spentMap: Record<string, number> = {};
  for (const row of txRows) {
    if (row.userId && row.categoryId) {
      spentMap[`${row.userId}|${row.categoryId}`] = toNum(row._sum.amount);
    }
  }

  let alerts = 0;

  for (const budget of budgets) {
    const spent = spentMap[`${budget.userId}|${budget.categoryId}`] ?? 0;
    const amount = toNum(budget.amount);
    const pct = amount > 0 ? Math.round((spent / amount) * 100) : 0;
    const icon = budget.category.icon ?? "📊";
    const name = budget.category.name;

    // Umbral alcanzado: 100% (superado) o el configurado (ej: 80%).
    const bucket = pct >= 100 ? 100 : pct >= budget.alertAt ? budget.alertAt : 0;

    // Anti-spam: solo avisamos cuando se cruza un umbral NUEVO (más alto que el
    // ya notificado este mes). Como hay una fila de presupuesto por mes/año,
    // `alertedPct` se resetea solo al cambiar de mes.
    if (bucket === 0 || bucket <= budget.alertedPct) continue;

    if (pct >= 100) {
      await sendPushToUser(budget.userId, {
        title: `⚠️ Presupuesto superado`,
        body: `${icon} ${name}: gastaste $${Math.round(spent).toLocaleString("es-AR")} de $${Math.round(amount).toLocaleString("es-AR")} (${pct}%)`,
        url: "/presupuestos",
      }).catch(() => {});
    } else {
      await sendPushToUser(budget.userId, {
        title: `🔔 Presupuesto al ${pct}%`,
        body: `${icon} ${name}: $${Math.round(spent).toLocaleString("es-AR")} gastados de $${Math.round(amount).toLocaleString("es-AR")}`,
        url: "/presupuestos",
      }).catch(() => {});
    }

    await prisma.budget.update({ where: { id: budget.id }, data: { alertedPct: bucket } }).catch(() => {});
    alerts++;
  }

  return Response.json({ ok: true, alerts, budgets: budgets.length, reminder });
}
