import { NextRequest } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { sendPushToUser } from "@/lib/push/send";
import { sendDailyReminders } from "@/lib/whatsapp/daily-reminder";
import { startOfTodayArg } from "@/lib/timezone";

// Vercel Cron: diariamente a las 23:00 UTC (20:00 ARG).
// Además de las alertas de presupuesto, dispara el recordatorio diario por
// WhatsApp (consolidado acá por el límite de 2 crons del plan Hobby de Vercel).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Auth exigida en todo ambiente (sin atajo por NODE_ENV).
  return bearerMatches(req.headers.get("authorization"), secret);
}

function toNum(v: unknown): number {
  if (!v) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Recordatorio diario por WhatsApp (20hs ARG). Best-effort: corre siempre,
  // aun si no hay presupuestos cargados.
  const reminder = await sendDailyReminders().catch(() => ({ sent: 0, skipped: 0, failed: 0 }));

  const now = startOfTodayArg();
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
    by: ["userId", "categoryId", "currency"],
    where: {
      userId: { in: userIds },
      type: "EXPENSE",
      date: { gte: dateFrom, lte: dateTo },
      categoryId: { in: budgets.map((b) => b.categoryId) },
    },
    _sum: { amount: true },
  });

  const spentMap: Record<string, number> = {};
  for (const row of txRows) {
    if (row.userId && row.categoryId) {
      spentMap[`${row.userId}|${row.categoryId}|${row.currency}`] = toNum(row._sum.amount);
    }
  }

  let alerts = 0;

  for (const budget of budgets) {
    const spent = spentMap[`${budget.userId}|${budget.categoryId}|${budget.currency}`] ?? 0;
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
        body: `${icon} ${name}: gastaste ${money(spent, budget.currency)} de ${money(amount, budget.currency)} (${pct}%)`,
        url: "/presupuestos",
      }).catch(() => {});
    } else {
      await sendPushToUser(budget.userId, {
        title: `🔔 Presupuesto al ${pct}%`,
        body: `${icon} ${name}: ${money(spent, budget.currency)} gastados de ${money(amount, budget.currency)}`,
        url: "/presupuestos",
      }).catch(() => {});
    }

    await prisma.budget.update({ where: { id: budget.id }, data: { alertedPct: bucket } }).catch(() => {});
    alerts++;
  }

  return Response.json({ ok: true, alerts, budgets: budgets.length, reminder });
}
