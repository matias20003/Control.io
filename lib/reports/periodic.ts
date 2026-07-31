import { randomBytes } from "node:crypto";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

export type ReportFrequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";

export type PeriodicReportSnapshot = {
  name: string;
  frequency: ReportFrequency;
  periodStart: string;
  periodEnd: string;
  income: number;
  expense: number;
  balance: number;
  savingsRate: number;
  transactionCount: number;
  avgDailyExpense: number;
  previousExpense: number;
  previousIncome: number;
  expenseChange: number | null;
  incomeChange: number | null;
  categories: { name: string; total: number; percentage: number; count: number; color: string }[];
  days: { date: string; income: number; expense: number }[];
  topExpenses: { description: string; category: string; amount: number; date: string }[];
  insights: string[];
};

const daysFor = (frequency: ReportFrequency) =>
  frequency === "WEEKLY" ? 7 : frequency === "FORTNIGHTLY" ? 15 : 30;

export function closedPeriod(frequency: ReportFrequency, now = new Date()) {
  const end = endOfDay(subDays(now, 1));
  const start = startOfDay(subDays(end, daysFor(frequency) - 1));
  return { start, end };
}

function number(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function change(current: number, previous: number) {
  return previous ? Math.round(((current - previous) / previous) * 100) : null;
}

export async function buildPeriodicSnapshot(
  userId: string,
  name: string,
  frequency: ReportFrequency,
  start: Date,
  end: Date,
): Promise<PeriodicReportSnapshot> {
  const duration = end.getTime() - start.getTime() + 1;
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration + 1);
  const [transactions, previous] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: start, lte: end } },
      include: { category: { select: { name: true, color: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.transaction.findMany({
      where: { userId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: prevStart, lte: prevEnd } },
      select: { type: true, amount: true },
    }),
  ]);

  let income = 0;
  let expense = 0;
  const categories = new Map<string, { total: number; count: number; color: string }>();
  const dayMap = new Map<string, { income: number; expense: number }>();

  for (const tx of transactions) {
    const amount = number(tx.amount);
    const key = tx.date.toISOString().slice(0, 10);
    const day = dayMap.get(key) ?? { income: 0, expense: 0 };
    if (tx.type === "INCOME") {
      income += amount;
      day.income += amount;
    } else {
      expense += amount;
      day.expense += amount;
      const category = tx.category?.name ?? "Sin categoría";
      const current = categories.get(category) ?? {
        total: 0,
        count: 0,
        color: tx.category?.color ?? "#94a3b8",
      };
      current.total += amount;
      current.count++;
      categories.set(category, current);
    }
    dayMap.set(key, day);
  }

  let previousIncome = 0;
  let previousExpense = 0;
  for (const tx of previous) {
    if (tx.type === "INCOME") previousIncome += number(tx.amount);
    else previousExpense += number(tx.amount);
  }

  const categoryRows = [...categories.entries()]
    .map(([categoryName, value]) => ({
      name: categoryName,
      ...value,
      percentage: expense ? Math.round((value.total / expense) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
  const balance = income - expense;
  const expenseChange = change(expense, previousExpense);
  const incomeChange = change(income, previousIncome);
  const top = categoryRows[0];
  const insights: string[] = [];
  if (income > 0) {
    const rate = Math.round((balance / income) * 100);
    insights.push(rate >= 20
      ? `Ahorraste el ${rate}% de tus ingresos: estás por encima del objetivo recomendado del 20%.`
      : `Tu tasa de ahorro fue ${rate}%. Para llegar al 20%, revisá primero los gastos de mayor peso.`);
  }
  if (expenseChange != null) {
    insights.push(expenseChange <= 0
      ? `Tus gastos bajaron ${Math.abs(expenseChange)}% frente al período anterior.`
      : `Tus gastos subieron ${expenseChange}% frente al período anterior.`);
  }
  if (top) insights.push(`${top.name} concentró el ${top.percentage}% de tus gastos (${top.count} movimientos).`);
  if (!insights.length) insights.push("Todavía no hay suficientes movimientos para calcular tendencias confiables.");

  return {
    name,
    frequency,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    income,
    expense,
    balance,
    savingsRate: income ? Math.round((balance / income) * 100) : 0,
    transactionCount: transactions.length,
    avgDailyExpense: expense / daysFor(frequency),
    previousExpense,
    previousIncome,
    expenseChange,
    incomeChange,
    categories: categoryRows,
    days: [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, ...value })),
    topExpenses: transactions
      .filter((tx) => tx.type === "EXPENSE")
      .sort((a, b) => number(b.amount) - number(a.amount))
      .slice(0, 8)
      .map((tx) => ({
        description: decrypt(tx.description) || "Gasto",
        category: tx.category?.name ?? "Sin categoría",
        amount: number(tx.amount),
        date: tx.date.toISOString(),
      })),
    insights,
  };
}

export function frequencyLabel(frequency: ReportFrequency) {
  return frequency === "WEEKLY" ? "semanal" : frequency === "FORTNIGHTLY" ? "quincenal" : "mensual";
}

export async function createReportDelivery(
  userId: string,
  snapshot: PeriodicReportSnapshot,
) {
  const label = frequencyLabel(snapshot.frequency);
  const title = `Reporte y tendencias ${label}`;
  const summary = snapshot.transactionCount
    ? `${snapshot.transactionCount} movimientos · Balance ${snapshot.balance >= 0 ? "positivo" : "negativo"}`
    : "El período cerró sin movimientos registrados";
  return prisma.reportDelivery.create({
    data: {
      id: `rpt_${randomBytes(12).toString("hex")}`,
      userId,
      frequency: snapshot.frequency,
      periodStart: new Date(snapshot.periodStart),
      periodEnd: new Date(snapshot.periodEnd),
      title,
      summary,
      snapshot,
      publicToken: randomBytes(24).toString("hex"),
    },
  });
}

