import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";

export type SerializedBudget = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  amount: number;
  currency: string;
  month: number;
  year: number;
  alertAt: number;
  spent: number;
  remaining: number;
  percentage: number;
};

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : parseFloat(String(val));
}

export async function getBudgets(
  userId: string,
  month: number,
  year: number
): Promise<SerializedBudget[]> {
  const dateFrom = startOfMonth(new Date(year, month - 1));
  const dateTo = endOfMonth(new Date(year, month - 1));

  const budgets = await prisma.budget.findMany({
    where: { userId, month, year },
    include: {
      category: { select: { name: true, icon: true, color: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (budgets.length === 0) return [];

  const txRows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      type: "EXPENSE",
      currency: "ARS",
      date: { gte: dateFrom, lte: dateTo },
      categoryId: { in: budgets.map((b) => b.categoryId) },
    },
    _sum: { amount: true },
  });

  const spentMap: Record<string, number> = {};
  for (const row of txRows) {
    if (row.categoryId) spentMap[row.categoryId] = toNum(row._sum.amount);
  }

  return budgets.map((b) => {
    const amount = toNum(b.amount);
    const spent = spentMap[b.categoryId] ?? 0;
    const remaining = amount - spent;
    const percentage = amount > 0 ? Math.min(Math.round((spent / amount) * 100), 100) : 0;
    return {
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.category.name,
      categoryIcon: b.category.icon ?? null,
      categoryColor: b.category.color ?? null,
      amount,
      currency: b.currency,
      month: b.month,
      year: b.year,
      alertAt: b.alertAt,
      spent,
      remaining,
      percentage,
    };
  });
}

export async function createOrUpdateBudget(
  userId: string,
  data: {
    categoryId: string;
    amount: number;
    currency?: string;
    month: number;
    year: number;
    alertAt?: number;
  }
): Promise<void> {
  await prisma.budget.upsert({
    where: {
      userId_categoryId_month_year: {
        userId,
        categoryId: data.categoryId,
        month: data.month,
        year: data.year,
      },
    },
    create: {
      userId,
      categoryId: data.categoryId,
      amount: data.amount,
      currency: data.currency ?? "ARS",
      month: data.month,
      year: data.year,
      alertAt: data.alertAt ?? 80,
    },
    update: {
      amount: data.amount,
      alertAt: data.alertAt ?? 80,
    },
  });
}

export async function deleteBudget(
  userId: string,
  budgetId: string
): Promise<void> {
  await prisma.budget.delete({ where: { id: budgetId, userId } });
}
