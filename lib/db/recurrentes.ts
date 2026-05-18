import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

export type SerializedRecurring = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  accountId: string | null;
  accountName: string | null;
  frequency: string;
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  lastExecuted: string | null;
  isActive: boolean;
  createdAt: string;
};

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : parseFloat(String(val));
}

function serialize(r: any): SerializedRecurring {
  return {
    id: r.id,
    type: r.type,
    amount: toNum(r.amount),
    currency: r.currency,
    description: decrypt(r.description) ?? r.description,
    categoryId: r.categoryId ?? null,
    categoryName: r.category?.name ?? null,
    categoryIcon: r.category?.icon ?? null,
    accountId: r.accountId ?? null,
    accountName: decrypt(r.account?.name ?? null),
    frequency: r.frequency,
    dayOfMonth: r.dayOfMonth ?? null,
    startDate:
      r.startDate instanceof Date ? r.startDate.toISOString() : r.startDate,
    endDate:
      r.endDate instanceof Date
        ? r.endDate.toISOString()
        : (r.endDate ?? null),
    lastExecuted:
      r.lastExecuted instanceof Date
        ? r.lastExecuted.toISOString()
        : (r.lastExecuted ?? null),
    isActive: r.isActive,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

const INCLUDE = {
  category: { select: { name: true, icon: true } },
  account: { select: { name: true } },
};

export async function getRecurrentes(
  userId: string
): Promise<SerializedRecurring[]> {
  const rows = await prisma.recurringTransaction.findMany({
    where: { userId },
    include: INCLUDE,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(serialize);
}

export async function createRecurrente(
  userId: string,
  data: {
    type: string;
    amount: number;
    currency: string;
    description: string;
    categoryId?: string;
    accountId?: string;
    frequency: string;
    dayOfMonth?: number;
    startDate: string;
    endDate?: string;
  }
): Promise<SerializedRecurring> {
  // Validamos ownership de la cuenta/categoría antes de guardar
  // (evita guardar IDs spoofed que después harían fallar el cron).
  if (data.accountId) {
    const acc = await prisma.account.findFirst({ where: { id: data.accountId, userId }, select: { id: true } });
    if (!acc) throw new Error("Cuenta inválida");
  }
  if (data.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: data.categoryId, userId }, select: { id: true } });
    if (!cat) throw new Error("Categoría inválida");
  }

  const row = await prisma.recurringTransaction.create({
    data: {
      userId,
      type: data.type as any,
      amount: data.amount,
      currency: data.currency,
      description: encrypt(data.description) ?? data.description,
      categoryId: data.categoryId || null,
      accountId: data.accountId || null,
      frequency: data.frequency as any,
      dayOfMonth: data.dayOfMonth ?? null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
    include: INCLUDE,
  });
  return serialize(row);
}

export async function toggleRecurrente(
  userId: string,
  id: string
): Promise<SerializedRecurring> {
  const current = await prisma.recurringTransaction.findFirst({
    where: { id, userId },
  });
  if (!current) throw new Error("No encontrado");

  const row = await prisma.recurringTransaction.update({
    where: { id },
    data: { isActive: !current.isActive },
    include: INCLUDE,
  });
  return serialize(row);
}

export async function updateRecurrente(
  userId: string,
  id: string,
  data: {
    type: string;
    amount: number;
    currency: string;
    description: string;
    categoryId?: string;
    accountId?: string;
    frequency: string;
    dayOfMonth?: number;
    startDate: string;
    endDate?: string;
  }
): Promise<SerializedRecurring> {
  const existing = await prisma.recurringTransaction.findFirst({
    where: { id, userId },
  });
  if (!existing) throw new Error("No encontrado");

  if (data.accountId) {
    const acc = await prisma.account.findFirst({ where: { id: data.accountId, userId }, select: { id: true } });
    if (!acc) throw new Error("Cuenta inválida");
  }
  if (data.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: data.categoryId, userId }, select: { id: true } });
    if (!cat) throw new Error("Categoría inválida");
  }

  const row = await prisma.recurringTransaction.update({
    where: { id },
    data: {
      type: data.type as any,
      amount: data.amount,
      currency: data.currency,
      description: encrypt(data.description) ?? data.description,
      categoryId: data.categoryId || null,
      accountId: data.accountId || null,
      frequency: data.frequency as any,
      dayOfMonth: data.dayOfMonth ?? null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
    include: INCLUDE,
  });
  return serialize(row);
}

export async function deleteRecurrente(
  userId: string,
  id: string
): Promise<void> {
  await prisma.recurringTransaction.delete({ where: { id, userId } });
}
