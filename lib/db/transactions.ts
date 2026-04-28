import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";

export type SerializedTransaction = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  date: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  accountId: string | null;
  accountName: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
  notes: string | null;
  createdAt: string;
};

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : parseFloat(String(val));
}

function serialize(tx: any): SerializedTransaction {
  return {
    id: tx.id,
    type: tx.type,
    amount: toNum(tx.amount),
    currency: tx.currency,
    description: tx.description,
    date: tx.date instanceof Date ? tx.date.toISOString() : tx.date,
    categoryId: tx.categoryId,
    categoryName: tx.category?.name ?? null,
    categoryIcon: tx.category?.icon ?? null,
    categoryColor: tx.category?.color ?? null,
    accountId: tx.accountId,
    accountName: tx.account?.name ?? null,
    toAccountId: tx.toAccountId,
    toAccountName: tx.toAccount?.name ?? null,
    notes: tx.notes,
    createdAt: tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt,
  };
}

export async function getTransactions(
  userId: string,
  filters: { type?: string; categoryId?: string; accountId?: string; month?: number; year?: number } = {}
): Promise<SerializedTransaction[]> {
  const now = new Date();
  const m = filters.month ?? now.getMonth() + 1;
  const y = filters.year ?? now.getFullYear();
  const dateFrom = startOfMonth(new Date(y, m - 1));
  const dateTo = endOfMonth(new Date(y, m - 1));

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      ...(filters.type && { type: filters.type as any }),
      ...(filters.categoryId && { categoryId: filters.categoryId }),
      ...(filters.accountId && { accountId: filters.accountId }),
      date: { gte: dateFrom, lte: dateTo },
    },
    include: {
      category: { select: { name: true, icon: true, color: true } },
      account:   { select: { name: true } },
      toAccount: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  return rows.map(serialize);
}

export async function createTransaction(userId: string, data: {
  type: string; amount: number; currency: string; description?: string;
  date: string; categoryId?: string; accountId?: string; toAccountId?: string; notes?: string;
}) {
  const tx = await prisma.transaction.create({
    data: {
      userId,
      type: data.type as any,
      amount: data.amount,
      currency: data.currency,
      description: data.description || null,
      date: new Date(data.date),
      categoryId: data.categoryId || null,
      accountId: data.accountId || null,
      toAccountId: data.toAccountId || null,
      notes: data.notes || null,
    },
    include: {
      category: { select: { name: true, icon: true, color: true } },
      account:   { select: { name: true } },
      toAccount: { select: { name: true } },
    },
  });

  // Actualizar saldo de cuenta
  if (data.accountId) {
    const delta = data.type === "INCOME" ? data.amount : -data.amount;
    await prisma.account.update({
      where: { id: data.accountId, userId },
      data: { balance: { increment: delta } },
    });
  }
  if (data.type === "TRANSFER" && data.toAccountId) {
    await prisma.account.update({
      where: { id: data.toAccountId, userId },
      data: { balance: { increment: data.amount } },
    });
  }

  return serialize(tx);
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  data: {
    type: string; amount: number; currency: string; description?: string;
    date: string; categoryId?: string; accountId?: string; toAccountId?: string; notes?: string;
  }
) {
  const existing = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });
  if (!existing) throw new Error("No encontrado");

  // Revertir efectos del movimiento anterior
  if (existing.accountId) {
    const oldAmount = toNum(existing.amount);
    const reverseDelta = existing.type === "INCOME" ? -oldAmount : oldAmount;
    await prisma.account.update({ where: { id: existing.accountId, userId }, data: { balance: { increment: reverseDelta } } });
  }
  if (existing.type === "TRANSFER" && existing.toAccountId) {
    await prisma.account.update({ where: { id: existing.toAccountId, userId }, data: { balance: { increment: -toNum(existing.amount) } } });
  }

  // Actualizar el movimiento
  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      type: data.type as any,
      amount: data.amount,
      currency: data.currency,
      description: data.description || null,
      date: new Date(data.date),
      categoryId: data.categoryId || null,
      accountId: data.accountId || null,
      toAccountId: data.toAccountId || null,
      notes: data.notes || null,
    },
    include: {
      category: { select: { name: true, icon: true, color: true } },
      account: { select: { name: true } },
      toAccount: { select: { name: true } },
    },
  });

  // Aplicar efectos del nuevo movimiento
  if (data.accountId) {
    const delta = data.type === "INCOME" ? data.amount : -data.amount;
    await prisma.account.update({ where: { id: data.accountId, userId }, data: { balance: { increment: delta } } });
  }
  if (data.type === "TRANSFER" && data.toAccountId) {
    await prisma.account.update({ where: { id: data.toAccountId, userId }, data: { balance: { increment: data.amount } } });
  }

  return serialize(updated);
}

export async function deleteTransaction(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });
  if (!tx) throw new Error("No encontrado");

  // Revertir saldo
  if (tx.accountId) {
    const amount = toNum(tx.amount);
    const delta = tx.type === "INCOME" ? -amount : amount;
    await prisma.account.update({
      where: { id: tx.accountId, userId },
      data: { balance: { increment: delta } },
    });
  }
  if (tx.type === "TRANSFER" && tx.toAccountId) {
    await prisma.account.update({
      where: { id: tx.toAccountId, userId },
      data: { balance: { increment: -toNum(tx.amount) } },
    });
  }

  await prisma.transaction.delete({ where: { id: transactionId } });
}

export type MonthSummary = {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: { categoryId: string; name: string; color: string; icon: string; total: number }[];
};

export async function getMonthSummary(userId: string, month?: number, year?: number): Promise<MonthSummary> {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();
  const dateFrom = startOfMonth(new Date(y, m - 1));
  const dateTo = endOfMonth(new Date(y, m - 1));

  const rows = await prisma.transaction.findMany({
    where: { userId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: dateFrom, lte: dateTo }, currency: "ARS" },
    include: { category: { select: { id: true, name: true, color: true, icon: true } } },
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const catMap: Record<string, { categoryId: string; name: string; color: string; icon: string; total: number }> = {};

  for (const r of rows) {
    const amount = toNum(r.amount);
    if (r.type === "INCOME") {
      totalIncome += amount;
    } else {
      totalExpense += amount;
      if (r.category) {
        const k = r.category.id;
        if (!catMap[k]) catMap[k] = { categoryId: k, name: r.category.name, color: r.category.color ?? "#94a3b8", icon: r.category.icon ?? "📦", total: 0 };
        catMap[k].total += amount;
      }
    }
  }

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byCategory: Object.values(catMap).sort((a, b) => b.total - a.total).slice(0, 8),
  };
}
