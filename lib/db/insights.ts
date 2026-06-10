import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";

export type Insight = {
  type: "warning" | "success" | "info";
  title: string;
  body: string;
  icon: string;
};

function toNum(v: unknown): number {
  if (!v) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

export async function getInsights(userId: string): Promise<Insight[]> {
  const now = new Date();
  const thisStart  = startOfMonth(now);
  const thisEnd    = endOfMonth(now);
  const prevStart  = startOfMonth(subMonths(now, 1));
  const prevEnd    = endOfMonth(subMonths(now, 1));

  const [thisTxs, prevTxs, budgets, goals] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, type: { in: ["INCOME", "EXPENSE"] }, currency: "ARS", date: { gte: thisStart, lte: thisEnd } },
      include: { category: { select: { name: true } } },
    }),
    prisma.transaction.findMany({
      where: { userId, type: "EXPENSE", currency: "ARS", date: { gte: prevStart, lte: prevEnd } },
      include: { category: { select: { name: true } } },
    }),
    prisma.budget.findMany({
      where: { userId, month: now.getMonth() + 1, year: now.getFullYear() },
      include: { category: { select: { name: true, icon: true } } },
    }),
    prisma.goal.findMany({
      where: { userId, isCompleted: false },
      orderBy: { deadline: "asc" },
      take: 3,
    }),
  ]);

  const insights: Insight[] = [];
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed  = now.getDate();

  // ── 1. Gastos por categoría vs mes anterior ───────────────
  const thisCatMap: Record<string, number> = {};
  const prevCatMap: Record<string, number> = {};
  let thisExpense = 0;
  let thisIncome  = 0;

  for (const tx of thisTxs) {
    const a = toNum(tx.amount);
    if (tx.type === "EXPENSE") {
      thisExpense += a;
      const cn = tx.category?.name ?? "Sin categoría";
      thisCatMap[cn] = (thisCatMap[cn] ?? 0) + a;
    } else {
      thisIncome += a;
    }
  }
  for (const tx of prevTxs) {
    const cn = tx.category?.name ?? "Sin categoría";
    prevCatMap[cn] = (prevCatMap[cn] ?? 0) + toNum(tx.amount);
  }

  // Biggest increase
  let biggestIncreaseCat = "";
  let biggestIncreasePct = 0;
  for (const [cat, amount] of Object.entries(thisCatMap)) {
    const prev = prevCatMap[cat] ?? 0;
    if (prev > 0 && amount > 1000) {
      const pct = Math.round(((amount - prev) / prev) * 100);
      if (pct > 30 && pct > biggestIncreasePct) {
        biggestIncreasePct = pct;
        biggestIncreaseCat = cat;
      }
    }
  }
  if (biggestIncreaseCat) {
    insights.push({
      type: "warning",
      icon: "📈",
      title: `${biggestIncreaseCat} subió ${biggestIncreasePct}%`,
      body: `Gastás más en ${biggestIncreaseCat} que el mes pasado. Revisá si es necesario.`,
    });
  }

  // ── 2. Ritmo de gasto proyectado ─────────────────────────
  if (daysPassed >= 5 && thisExpense > 0) {
    const dailyRate     = thisExpense / daysPassed;
    const projectedEnd  = dailyRate * daysInMonth;
    const prevMonthExpense = prevTxs.reduce((s, t) => s + toNum(t.amount), 0);

    if (prevMonthExpense > 0) {
      const overPct = Math.round(((projectedEnd - prevMonthExpense) / prevMonthExpense) * 100);
      if (overPct > 15) {
        const fmt = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
        insights.push({
          type: "warning",
          icon: "⚠️",
          title: "Vas camino a gastar más este mes",
          body: `Al ritmo actual vas a gastar ${fmt(projectedEnd)} (+${overPct}% vs el mes pasado).`,
        });
      } else if (overPct < -10) {
        insights.push({
          type: "success",
          icon: "✅",
          title: "Buen ritmo de gasto",
          body: `Al ritmo actual gastarás ${Math.abs(overPct)}% menos que el mes pasado.`,
        });
      }
    }
  }

  // ── 3. Presupuestos superados ────────────────────────────
  // Una sola query agrupada por categoría (antes era una por presupuesto: N+1).
  if (budgets.length > 0) {
    const spendByCat = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        type: "EXPENSE",
        currency: "ARS",
        date: { gte: thisStart, lte: thisEnd },
        categoryId: { in: budgets.map((b) => b.categoryId) },
      },
      _sum: { amount: true },
    });
    const spentByCat = new Map(
      spendByCat.map((r) => [r.categoryId, toNum(r._sum.amount)])
    );
    const daysLeft = daysInMonth - daysPassed;

    for (const b of budgets) {
      const spent = spentByCat.get(b.categoryId) ?? 0;
      const limit = toNum(b.amount);
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      if (pct >= 100) {
        insights.push({
          type: "warning",
          icon: b.category.icon ?? "🔴",
          title: `Presupuesto de ${b.category.name} superado`,
          body: `Gastaste ${pct}% del presupuesto. Quedan ${daysLeft} días del mes.`,
        });
      }
    }
  }

  // ── 4. Tasa de ahorro este mes ────────────────────────────
  if (thisIncome > 0 && daysPassed >= 10) {
    const rate = Math.round(((thisIncome - thisExpense) / thisIncome) * 100);
    if (rate >= 20) {
      insights.push({
        type: "success",
        icon: "🎯",
        title: `Tasa de ahorro del ${rate}%`,
        body: "¡Estás ahorrando por encima del 20% recomendado este mes!",
      });
    } else if (rate < 0) {
      insights.push({
        type: "warning",
        icon: "🔴",
        title: "Gastos superan ingresos",
        body: `Gastaste ${Math.abs(rate)}% más de lo que ingresaste este mes.`,
      });
    }
  }

  // ── 5. Metas próximas a vencer ───────────────────────────
  for (const g of goals) {
    if (!g.deadline) continue;
    const daysLeft = differenceInDays(new Date(g.deadline), now);
    if (daysLeft > 0 && daysLeft <= 30) {
      const target  = toNum(g.targetAmount);
      const current = toNum(g.currentAmount);
      const pct     = target > 0 ? Math.round((current / target) * 100) : 0;
      insights.push({
        type: pct >= 80 ? "success" : "info",
        icon: g.icon ?? "🎯",
        title: `Meta "${decrypt(g.name) ?? g.name}" vence en ${daysLeft} días`,
        body: `Llevas el ${pct}% (${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(current)} de ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(target)}).`,
      });
    }
  }

  // ── 6. Mayor categoría de gasto del mes (conciencia) ─────
  // Solo si una categoría concentra ≥30% del gasto: ahí sí es accionable.
  const topCat = Object.entries(thisCatMap).sort((a, b) => b[1] - a[1])[0];
  if (topCat && thisExpense > 0 && topCat[1] / thisExpense >= 0.3) {
    const pct = Math.round((topCat[1] / thisExpense) * 100);
    insights.push({
      type: "info",
      icon: "📊",
      title: `${topCat[0]} es tu mayor gasto`,
      body: `Representa el ${pct}% de lo que gastaste este mes. Tenerlo presente ayuda a decidir dónde recortar.`,
    });
  }

  // Priorizamos como lo haría un asesor: primero los problemas (warning),
  // después los logros (success), al final lo informativo (info).
  const orden = { warning: 0, success: 1, info: 2 } as const;
  insights.sort((a, b) => orden[a.type] - orden[b.type]);

  return insights.slice(0, 4); // máximo 4 insights
}

// ── Patrimonio neto ───────────────────────────────────────────
export type NetWorth = {
  totalAssets: number;     // saldo de cuentas ARS
  totalLiabilities: number; // deudas pendientes + cuotas pendientes ARS
  netWorth: number;
};

export async function getNetWorth(userId: string): Promise<NetWorth> {
  const [accounts, debts, creditPurchases] = await Promise.all([
    prisma.account.findMany({ where: { userId, isActive: true, currency: "ARS" }, select: { balance: true } }),
    prisma.debt.findMany({ where: { userId, isCompleted: false, currency: "ARS" }, select: { totalAmount: true, paidAmount: true } }),
    prisma.creditPurchase.findMany({ where: { userId, currency: "ARS" }, include: { installments: { where: { isPaid: false }, select: { amount: true } } } }),
  ]);

  const totalAssets = accounts.reduce((s, a) => s + toNum(a.balance), 0);

  const debtLiability = debts.reduce((s, d) => s + (toNum(d.totalAmount) - toNum(d.paidAmount)), 0);
  const creditLiability = creditPurchases.reduce(
    (s, cp) => s + cp.installments.reduce((ss, i) => ss + toNum(i.amount), 0),
    0
  );

  const totalLiabilities = debtLiability + creditLiability;

  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
}
