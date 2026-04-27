import { prisma } from "@/lib/prisma";

export type SerializedRecurring = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
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
    description: r.description,
    categoryId: r.categoryId ?? null,
    categoryName: r.category?.name ?? null,
    categoryIcon: r.category?.icon ?? null,
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
    frequency: string;
    dayOfMonth?: number;
    startDate: string;
    endDate?: string;
  }
): Promise<SerializedRecurring> {
  const row = await prisma.recurringTransaction.create({
    data: {
      userId,
      type: data.type as any,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      categoryId: data.categoryId || null,
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

export async function deleteRecurrente(
  userId: string,
  id: string
): Promise<void> {
  await prisma.recurringTransaction.delete({ where: { id, userId } });
}
