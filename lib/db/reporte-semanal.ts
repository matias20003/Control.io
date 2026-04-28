import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, subWeeks, format, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";

export type DayData = {
  label: string;   // "Lun", "Mar", ...
  date: string;    // ISO
  income: number;
  expense: number;
};

export type CategoryData = {
  name: string;
  icon: string;
  color: string;
  total: number;
  percentage: number;
  count: number;
};

export type WeekTransaction = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  date: string;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  accountName: string | null;
};

export type ReporteSemanal = {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  income: number;
  expense: number;
  balance: number;
  savingsRate: number;
  txCount: number;
  avgDailyExpense: number;
  biggestExpense: WeekTransaction | null;
  byDay: DayData[];
  byCategory: CategoryData[];
  transactions: WeekTransaction[];
  // vs semana anterior
  prevIncome: number;
  prevExpense: number;
  incomeChange: number | null;
  expenseChange: number | null;
};

function toNum(v: unknown): number {
  if (!v) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

export async function getReporteSemanal(
  userId: string,
  weekOffset = 0          // 0 = esta semana, 1 = semana pasada, etc.
): Promise<ReporteSemanal> {
  const baseDate = subWeeks(new Date(), weekOffset);
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(baseDate,   { weekStartsOn: 1 });

  const prevStart = startOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 });
  const prevEnd   = endOfWeek(subWeeks(baseDate, 1),   { weekStartsOn: 1 });

  const [thisTxs, prevTxs] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: weekStart, lte: weekEnd } },
      include: {
        category: { select: { name: true, icon: true, color: true } },
        account:  { select: { name: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.transaction.findMany({
      where: { userId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: prevStart, lte: prevEnd } },
    }),
  ]);

  // ── Totales ────────────────────────────────────────────────
  let income = 0, expense = 0;
  for (const tx of thisTxs) {
    const a = toNum(tx.amount);
    if (tx.type === "INCOME") income += a; else expense += a;
  }

  let prevIncome = 0, prevExpense = 0;
  for (const tx of prevTxs) {
    const a = toNum(tx.amount);
    if (tx.type === "INCOME") prevIncome += a; else prevExpense += a;
  }

  const balance     = income - expense;
  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;
  const expenseTxs  = thisTxs.filter((t) => t.type === "EXPENSE");
  const avgDailyExpense = expense / 7;

  // ── Por día ────────────────────────────────────────────────
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const byDay: DayData[] = days.map((d) => {
    const dayStr = d.toDateString();
    let dayIncome = 0, dayExpense = 0;
    for (const tx of thisTxs) {
      if (new Date(tx.date).toDateString() !== dayStr) continue;
      const a = toNum(tx.amount);
      if (tx.type === "INCOME") dayIncome += a; else dayExpense += a;
    }
    return {
      label: format(d, "EEE", { locale: es }),
      date: d.toISOString(),
      income: dayIncome,
      expense: dayExpense,
    };
  });

  // ── Por categoría ──────────────────────────────────────────
  const catMap: Record<string, { icon: string; color: string; total: number; count: number }> = {};
  for (const tx of expenseTxs) {
    const name  = tx.category?.name  ?? "Sin categoría";
    const icon  = tx.category?.icon  ?? "📦";
    const color = tx.category?.color ?? "#94a3b8";
    catMap[name] = catMap[name] ?? { icon, color, total: 0, count: 0 };
    catMap[name].total += toNum(tx.amount);
    catMap[name].count++;
  }
  const byCategory: CategoryData[] = Object.entries(catMap)
    .map(([name, v]) => ({
      name,
      icon: v.icon,
      color: v.color,
      total: v.total,
      percentage: expense > 0 ? Math.round((v.total / expense) * 100) : 0,
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total);

  // ── Mayor gasto ────────────────────────────────────────────
  const biggest = expenseTxs.reduce<typeof expenseTxs[0] | null>(
    (max, tx) => (!max || toNum(tx.amount) > toNum(max.amount) ? tx : max),
    null
  );

  const serialize = (tx: typeof thisTxs[0]): WeekTransaction => ({
    id:            tx.id,
    type:          tx.type,
    amount:        toNum(tx.amount),
    currency:      tx.currency,
    description:   tx.description,
    date:          tx.date instanceof Date ? tx.date.toISOString() : String(tx.date),
    categoryName:  tx.category?.name  ?? null,
    categoryIcon:  tx.category?.icon  ?? null,
    categoryColor: tx.category?.color ?? null,
    accountName:   tx.account?.name   ?? null,
  });

  const weekLabel =
    weekOffset === 0
      ? "Esta semana"
      : weekOffset === 1
      ? "Semana pasada"
      : `Semana del ${format(weekStart, "d MMM", { locale: es })}`;

  return {
    weekStart:    weekStart.toISOString(),
    weekEnd:      weekEnd.toISOString(),
    weekLabel,
    income,
    expense,
    balance,
    savingsRate,
    txCount:       thisTxs.length,
    avgDailyExpense,
    biggestExpense: biggest ? serialize(biggest) : null,
    byDay,
    byCategory,
    transactions:  thisTxs.map(serialize),
    prevIncome,
    prevExpense,
    incomeChange:  pctChange(income, prevIncome),
    expenseChange: pctChange(expense, prevExpense),
  };
}
