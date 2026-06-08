import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { encrypt, decrypt } from "@/lib/crypto";
import { startOfTodayArg, endOfTodayArg } from "@/lib/timezone";
import { snapshotConversion } from "@/lib/exchange";

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
    description: decrypt(tx.description),           // ← decrypt on read
    date: tx.date instanceof Date ? tx.date.toISOString() : tx.date,
    categoryId: tx.categoryId,
    categoryName: tx.category?.name ?? null,
    categoryIcon: tx.category?.icon ?? null,
    categoryColor: tx.category?.color ?? null,
    accountId: tx.accountId,
    accountName: decrypt(tx.account?.name) ?? null,
    toAccountId: tx.toAccountId,
    toAccountName: decrypt(tx.toAccount?.name) ?? null,
    notes: decrypt(tx.notes),                       // ← decrypt on read
    createdAt: tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt,
  };
}

export type TransactionsPage = {
  items: SerializedTransaction[];
  total: number;
  hasMore: boolean;
};

const DEFAULT_PAGE_SIZE = 100;

/**
 * Devuelve transacciones paginadas. Sin paginación una cuenta con 10k+
 * movimientos hace que el dashboard tarde varios segundos y consuma RAM
 * inecesaria del server. Default: 100 por página, ordenados por fecha desc.
 */
export async function getTransactions(
  userId: string,
  filters: {
    type?: string;
    categoryId?: string;
    accountId?: string;
    month?: number;
    year?: number;
    take?: number;
    skip?: number;
  } = {}
): Promise<TransactionsPage> {
  const now = new Date();
  const m = filters.month ?? now.getMonth() + 1;
  const y = filters.year ?? now.getFullYear();
  const dateFrom = startOfMonth(new Date(y, m - 1));
  const dateTo = endOfMonth(new Date(y, m - 1));

  const take = filters.take ?? DEFAULT_PAGE_SIZE;
  const skip = filters.skip ?? 0;

  const where = {
    userId,
    ...(filters.type && { type: filters.type as any }),
    ...(filters.categoryId && { categoryId: filters.categoryId }),
    ...(filters.accountId && { accountId: filters.accountId }),
    date: { gte: dateFrom, lte: dateTo },
  };

  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: { select: { name: true, icon: true, color: true } },
        account:   { select: { name: true } },
        toAccount: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take,
      skip,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    items: rows.map(serialize),
    total,
    hasMore: skip + rows.length < total,
  };
}

export async function createTransaction(userId: string, data: {
  type: string; amount: number; currency: string; description?: string;
  date: string; categoryId?: string; accountId?: string; toAccountId?: string; notes?: string;
}) {
  // Las transferencias no llevan categoría (evita relaciones huérfanas que
  // luego confunden a reportes y presupuestos).
  if (data.type === "TRANSFER") data.categoryId = undefined;

  // Pre-validamos ownership de cuentas/categoría. Sin esto un cliente malicioso
  // podría enviar IDs de otro usuario y, aunque Prisma rechace el update por la
  // composite where, igual queda creada la Transaction con FKs inválidos.
  if (data.accountId) {
    const acc = await prisma.account.findFirst({ where: { id: data.accountId, userId }, select: { id: true } });
    if (!acc) throw new Error("Cuenta inválida");
  }
  if (data.toAccountId) {
    const toAcc = await prisma.account.findFirst({ where: { id: data.toAccountId, userId }, select: { id: true } });
    if (!toAcc) throw new Error("Cuenta destino inválida");
  }
  if (data.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: data.categoryId, userId }, select: { id: true } });
    if (!cat) throw new Error("Categoría inválida");
  }

  // Snapshot del tipo de cambio. Si el movimiento es en USD lo dejamos
  // expresado también en ARS para que los reportes puedan sumar todo.
  const { amountARS, exchangeRate } = await snapshotConversion(data.amount, data.currency);

  // Todo el flujo en una sola tx para que crear el movimiento + actualizar saldos
  // sean atómicos: si una operación falla, ninguna persiste.
  return prisma.$transaction(async (db) => {
    const tx = await db.transaction.create({
      data: {
        userId,
        type: data.type as any,
        amount: data.amount,
        currency: data.currency,
        amountARS,
        exchangeRate,
        description: encrypt(data.description || null), // ← encrypt on write
        date: new Date(data.date),
        categoryId: data.categoryId || null,
        accountId: data.accountId || null,
        toAccountId: data.toAccountId || null,
        notes: encrypt(data.notes || null),             // ← encrypt on write
      },
      include: {
        category: { select: { name: true, icon: true, color: true } },
        account:   { select: { name: true } },
        toAccount: { select: { name: true } },
      },
    });

    if (data.accountId) {
      const delta = data.type === "INCOME" ? data.amount : -data.amount;
      await db.account.update({
        where: { id: data.accountId, userId },
        data: { balance: { increment: delta } },
      });
    }
    if (data.type === "TRANSFER" && data.toAccountId) {
      await db.account.update({
        where: { id: data.toAccountId, userId },
        data: { balance: { increment: data.amount } },
      });
    }

    return serialize(tx);
  });
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

  // Validar ownership de las nuevas cuentas/categoría antes de tocar saldos.
  if (data.accountId) {
    const acc = await prisma.account.findFirst({ where: { id: data.accountId, userId }, select: { id: true } });
    if (!acc) throw new Error("Cuenta inválida");
  }
  if (data.toAccountId) {
    const toAcc = await prisma.account.findFirst({ where: { id: data.toAccountId, userId }, select: { id: true } });
    if (!toAcc) throw new Error("Cuenta destino inválida");
  }
  if (data.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: data.categoryId, userId }, select: { id: true } });
    if (!cat) throw new Error("Categoría inválida");
  }

  // Reverso + write + apply, todo atómico. Si algo falla, los saldos
  // no quedan a medio actualizar.
  return prisma.$transaction(async (db) => {
    if (existing.accountId) {
      const oldAmount = toNum(existing.amount);
      const reverseDelta = existing.type === "INCOME" ? -oldAmount : oldAmount;
      await db.account.update({ where: { id: existing.accountId, userId }, data: { balance: { increment: reverseDelta } } });
    }
    if (existing.type === "TRANSFER" && existing.toAccountId) {
      await db.account.update({ where: { id: existing.toAccountId, userId }, data: { balance: { increment: -toNum(existing.amount) } } });
    }

    // Snapshot del rate también en update — el usuario puede haber cambiado
    // el monto o la moneda y queremos que amountARS quede coherente.
    const { amountARS, exchangeRate } = await snapshotConversion(data.amount, data.currency);

    const updated = await db.transaction.update({
      where: { id: transactionId, userId },
      data: {
        type: data.type as any,
        amount: data.amount,
        currency: data.currency,
        amountARS,
        exchangeRate,
        description: encrypt(data.description || null), // ← encrypt on write
        date: new Date(data.date),
        categoryId: data.categoryId || null,
        accountId: data.accountId || null,
        toAccountId: data.toAccountId || null,
        notes: encrypt(data.notes || null),             // ← encrypt on write
      },
      include: {
        category: { select: { name: true, icon: true, color: true } },
        account: { select: { name: true } },
        toAccount: { select: { name: true } },
      },
    });

    if (data.accountId) {
      const delta = data.type === "INCOME" ? data.amount : -data.amount;
      await db.account.update({ where: { id: data.accountId, userId }, data: { balance: { increment: delta } } });
    }
    if (data.type === "TRANSFER" && data.toAccountId) {
      await db.account.update({ where: { id: data.toAccountId, userId }, data: { balance: { increment: data.amount } } });
    }

    return serialize(updated);
  });
}

export async function deleteTransaction(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });
  if (!tx) throw new Error("No encontrado");

  // Reverso de saldo + borrado, atómico.
  await prisma.$transaction(async (db) => {
    if (tx.accountId) {
      const amount = toNum(tx.amount);
      const delta = tx.type === "INCOME" ? -amount : amount;
      await db.account.update({
        where: { id: tx.accountId, userId },
        data: { balance: { increment: delta } },
      });
    }
    if (tx.type === "TRANSFER" && tx.toAccountId) {
      await db.account.update({
        where: { id: tx.toAccountId, userId },
        data: { balance: { increment: -toNum(tx.amount) } },
      });
    }
    await db.transaction.delete({ where: { id: transactionId } });
  });
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

export async function hasTransactionToday(userId: string): Promise<boolean> {
  // "Hoy" en hora Argentina: el server corre en UTC, así que sin esto el
  // límite de día se mueve 3 horas y el cartel aparece cuando no debería.
  const count = await prisma.transaction.count({
    where: { userId, createdAt: { gte: startOfTodayArg(), lte: endOfTodayArg() } },
  });
  return count > 0;
}
