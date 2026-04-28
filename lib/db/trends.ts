import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { es } from "date-fns/locale";

export type MonthTrend = {
  month: number;
  year: number;
  label: string;
  income: number;
  expense: number;
  balance: number;
  savingsRate: number;
};

export type CategoryTrend = {
  name: string;
  icon: string;
  color: string;
  months: number[]; // expense per month, aligned to MonthTrend[]
};

export type TrendsData = {
  months: MonthTrend[];
  categories: CategoryTrend[];
  avgIncome: number;
  avgExpense: number;
  bestMonth: MonthTrend | null;
  worstMonth: MonthTrend | null;
};

function toNum(v: unknown): number {
  if (!v) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

export async function getTrends(userId: string, numMonths = 6): Promise<TrendsData> {
  const now = new Date();

  // Build array of months [oldest … current]
  const ranges = Array.from({ length: numMonths }, (_, i) => {
    const d = subMonths(now, numMonths - 1 - i);
    return {
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      start: startOfMonth(d),
      end: endOfMonth(d),
      label: format(d, "MMM yy", { locale: es }),
    };
  });

  // Fetch all transactions in range
  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      type: { in: ["INCOME", "EXPENSE"] },
      currency: "ARS",
      date: { gte: ranges[0].start, lte: ranges[ranges.length - 1].end },
    },
    select: {
      type: true,
      amount: true,
      date: true,
      category: { select: { name: true, icon: true, color: true } },
    },
  });

  // Aggregate per month
  const monthMap: Record<string, { income: number; expense: number; cats: Record<string, { icon: string; color: string; total: number }> }> = {};

  for (const r of ranges) {
    monthMap[`${r.year}-${r.month}`] = { income: 0, expense: 0, cats: {} };
  }

  for (const tx of txs) {
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!monthMap[key]) continue;
    const amount = toNum(tx.amount);
    if (tx.type === "INCOME") {
      monthMap[key].income += amount;
    } else {
      monthMap[key].expense += amount;
      if (tx.category) {
        const cn = tx.category.name;
        monthMap[key].cats[cn] = monthMap[key].cats[cn] ?? { icon: tx.category.icon ?? "📦", color: tx.category.color ?? "#94a3b8", total: 0 };
        monthMap[key].cats[cn].total += amount;
      }
    }
  }

  const months: MonthTrend[] = ranges.map((r) => {
    const { income, expense } = monthMap[`${r.year}-${r.month}`];
    const balance = income - expense;
    const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;
    return { month: r.month, year: r.year, label: r.label, income, expense, balance, savingsRate };
  });

  // Build top categories across all months
  const allCats: Record<string, { icon: string; color: string; totals: number[] }> = {};

  ranges.forEach((r, idx) => {
    const cats = monthMap[`${r.year}-${r.month}`].cats;
    for (const [name, v] of Object.entries(cats)) {
      if (!allCats[name]) allCats[name] = { icon: v.icon, color: v.color, totals: Array(numMonths).fill(0) };
      allCats[name].totals[idx] = v.total;
    }
  });

  // Keep top 5 by total
  const categories: CategoryTrend[] = Object.entries(allCats)
    .map(([name, v]) => ({
      name,
      icon: v.icon,
      color: v.color,
      months: v.totals,
    }))
    .sort((a, b) => b.months.reduce((s, x) => s + x, 0) - a.months.reduce((s, x) => s + x, 0))
    .slice(0, 5);

  const withExpense = months.filter((m) => m.expense > 0 || m.income > 0);
  const avgIncome = withExpense.length ? withExpense.reduce((s, m) => s + m.income, 0) / withExpense.length : 0;
  const avgExpense = withExpense.length ? withExpense.reduce((s, m) => s + m.expense, 0) / withExpense.length : 0;

  const bestMonth = months.reduce((best: MonthTrend | null, m) => (!best || m.balance > best.balance ? m : best), null);
  const worstMonth = months.reduce((worst: MonthTrend | null, m) => (!worst || m.balance < worst.balance ? m : worst), null);

  return { months, categories, avgIncome, avgExpense, bestMonth, worstMonth };
}
