import { prisma } from "@/lib/prisma";
import { addMonths } from "date-fns";

export type SerializedCreditInstallment = {
  id: number;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  paidAt: string | null;
};

export type SerializedCreditPurchase = {
  id: string;
  accountId: string;
  accountName: string | null;
  description: string;
  totalAmount: number;
  currency: string;
  totalInstallments: number;
  paidInstallments: number;
  firstPaymentDate: string;
  categoryId: string | null;
  installments: SerializedCreditInstallment[];
  createdAt: string;
};

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : parseFloat(String(val));
}

function serializeInstallment(i: any): SerializedCreditInstallment {
  return {
    id: i.id,
    installmentNumber: i.installmentNumber,
    amount: toNum(i.amount),
    dueDate: i.dueDate instanceof Date ? i.dueDate.toISOString() : i.dueDate,
    isPaid: i.isPaid,
    paidAt: i.paidAt instanceof Date ? i.paidAt.toISOString() : (i.paidAt ?? null),
  };
}

function serialize(p: any): SerializedCreditPurchase {
  return {
    id: p.id,
    accountId: p.accountId,
    accountName: p.account?.name ?? null,
    description: p.description,
    totalAmount: toNum(p.totalAmount),
    currency: p.currency,
    totalInstallments: p.totalInstallments,
    paidInstallments: p.paidInstallments,
    firstPaymentDate:
      p.firstPaymentDate instanceof Date
        ? p.firstPaymentDate.toISOString()
        : p.firstPaymentDate,
    categoryId: p.categoryId ?? null,
    installments: (p.installments ?? []).map(serializeInstallment),
    createdAt:
      p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
}

const INCLUDE = {
  account: { select: { name: true } },
  installments: { orderBy: { installmentNumber: "asc" as const } },
};

export async function getCreditPurchases(
  userId: string
): Promise<SerializedCreditPurchase[]> {
  const rows = await prisma.creditPurchase.findMany({
    where: { userId },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serialize);
}

export async function createCreditPurchase(
  userId: string,
  data: {
    accountId: string;
    description: string;
    totalAmount: number;
    currency: string;
    totalInstallments: number;
    firstPaymentDate: string;
    categoryId?: string;
  }
): Promise<SerializedCreditPurchase> {
  const firstDate = new Date(data.firstPaymentDate);
  const baseAmount = data.totalAmount / data.totalInstallments;
  const rounded = parseFloat(baseAmount.toFixed(2));

  const installmentsData = Array.from(
    { length: data.totalInstallments },
    (_, i) => ({
      installmentNumber: i + 1,
      amount: rounded,
      dueDate: addMonths(firstDate, i),
    })
  );

  const row = await prisma.creditPurchase.create({
    data: {
      userId,
      accountId: data.accountId,
      description: data.description,
      totalAmount: data.totalAmount,
      currency: data.currency,
      totalInstallments: data.totalInstallments,
      firstPaymentDate: firstDate,
      categoryId: data.categoryId || null,
      installments: { create: installmentsData },
    },
    include: INCLUDE,
  });
  return serialize(row);
}

export async function payInstallment(
  userId: string,
  installmentId: number
): Promise<void> {
  const installment = await prisma.creditInstallment.findUnique({
    where: { id: installmentId },
    include: { creditPurchase: { select: { userId: true, id: true } } },
  });
  if (!installment || installment.creditPurchase.userId !== userId) {
    throw new Error("No encontrado");
  }

  await prisma.creditInstallment.update({
    where: { id: installmentId },
    data: { isPaid: true, paidAt: new Date() },
  });

  await prisma.creditPurchase.update({
    where: { id: installment.creditPurchaseId },
    data: { paidInstallments: { increment: 1 } },
  });
}

export async function updateCreditPurchase(
  userId: string,
  purchaseId: string,
  data: {
    description?: string;
    accountId?: string;
    categoryId?: string | null;
    currency?: string;
    totalAmount?: number;
    firstPaymentDate?: string;
  }
): Promise<SerializedCreditPurchase> {
  // Get current purchase to know unpaid installments
  const current = await prisma.creditPurchase.findUnique({
    where: { id: purchaseId, userId },
    include: { installments: { orderBy: { installmentNumber: "asc" } } },
  });
  if (!current) throw new Error("No encontrado");

  const unpaid = current.installments.filter((i) => !i.isPaid);
  const newFirstDate = data.firstPaymentDate ? new Date(data.firstPaymentDate) : null;
  const newAmount = data.totalAmount;
  const baseAmount = newAmount !== undefined
    ? parseFloat((newAmount / current.totalInstallments).toFixed(2))
    : null;

  const row = await prisma.$transaction(async (tx) => {
    // Recalculate unpaid installments if date or amount changed
    for (const inst of unpaid) {
      const updates: any = {};
      if (newFirstDate) updates.dueDate = addMonths(newFirstDate, inst.installmentNumber - 1);
      if (baseAmount !== null) updates.amount = baseAmount;
      if (Object.keys(updates).length > 0) {
        await tx.creditInstallment.update({ where: { id: inst.id }, data: updates });
      }
    }

    return tx.creditPurchase.update({
      where: { id: purchaseId, userId },
      data: {
        ...(data.description !== undefined && { description: data.description }),
        ...(data.accountId !== undefined && { accountId: data.accountId }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(newAmount !== undefined && { totalAmount: newAmount }),
        ...(newFirstDate && { firstPaymentDate: newFirstDate }),
      },
      include: INCLUDE,
    });
  });

  return serialize(row);
}

export async function deleteCreditPurchase(
  userId: string,
  purchaseId: string
): Promise<void> {
  await prisma.creditPurchase.delete({ where: { id: purchaseId, userId } });
}
