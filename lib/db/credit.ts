import { prisma } from "@/lib/prisma";
import { addMonths } from "date-fns";
import { encrypt } from "@/lib/crypto";
import { splitInstallments } from "@/lib/db/credit-utils";

export { splitInstallments };

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

  // splitInstallments garantiza que la suma de cuotas dé el total exacto
  // (la última absorbe el redondeo). Ver lib/db/credit-utils.ts.
  const installmentsData = splitInstallments(
    data.totalAmount,
    data.totalInstallments
  ).map((amount, i) => ({
    installmentNumber: i + 1,
    amount,
    dueDate: addMonths(firstDate, i),
  }));

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
    include: {
      creditPurchase: {
        select: {
          userId: true,
          id: true,
          accountId: true,
          categoryId: true,
          currency: true,
          description: true,
          totalInstallments: true,
        },
      },
    },
  });
  if (!installment || installment.creditPurchase.userId !== userId) {
    throw new Error("No encontrado");
  }
  if (installment.isPaid) return; // idempotente: si ya estaba pagada, no duplicamos

  const purchase = installment.creditPurchase;
  const now = new Date();
  const amount = installment.amount; // Decimal, prisma lo acepta tal cual
  const description =
    `Cuota ${installment.installmentNumber}/${purchase.totalInstallments} · ${purchase.description}`;

  await prisma.$transaction([
    prisma.creditInstallment.update({
      where: { id: installmentId },
      data: { isPaid: true, paidAt: now },
    }),
    prisma.creditPurchase.update({
      where: { id: purchase.id, userId },
      data: { paidInstallments: { increment: 1 } },
    }),
    // Movimiento equivalente, queda visible en /movimientos.
    // Se asocia a la compra vía creditPurchaseId para poder limpiarlo si se elimina.
    prisma.transaction.create({
      data: {
        userId,
        type: "EXPENSE",
        amount,
        currency: purchase.currency,
        description: encrypt(description),
        date: now,
        categoryId: purchase.categoryId,
        accountId: purchase.accountId,
        creditPurchaseId: purchase.id,
      },
    }),
    // Descontamos el saldo de la cuenta de pago.
    prisma.account.update({
      where: { id: purchase.accountId, userId },
      data: { balance: { decrement: amount } },
    }),
  ]);
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

  // Si cambia el monto total, re-dividimos SOLO lo que falta pagar entre las
  // cuotas impagas, de modo que (pagado + impago) sume EXACTAMENTE el nuevo
  // total (la última cuota absorbe el redondeo). Antes ponía total/n por cuota
  // y la suma no cerraba, además de ignorar lo ya pagado.
  let newUnpaidAmounts: number[] | null = null;
  if (newAmount !== undefined && unpaid.length > 0) {
    const paidSum = current.installments
      .filter((i) => i.isPaid)
      .reduce((s, i) => s + toNum(i.amount), 0);
    const remaining = Math.max(0, newAmount - paidSum);
    newUnpaidAmounts = splitInstallments(remaining, unpaid.length);
  }

  const row = await prisma.$transaction(async (tx) => {
    // Recalculate unpaid installments if date or amount changed
    for (let idx = 0; idx < unpaid.length; idx++) {
      const inst = unpaid[idx];
      const updates: any = {};
      if (newFirstDate) updates.dueDate = addMonths(newFirstDate, inst.installmentNumber - 1);
      if (newUnpaidAmounts) updates.amount = newUnpaidAmounts[idx];
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
  // Desvinculamos primero las transacciones generadas por las cuotas pagadas:
  // se conservan en /movimientos (los pagos ya ocurrieron y afectaron saldo),
  // pero dejan de apuntar a la compra que estamos por eliminar.
  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { creditPurchaseId: purchaseId, userId },
      data: { creditPurchaseId: null },
    }),
    prisma.creditPurchase.delete({ where: { id: purchaseId, userId } }),
  ]);
}
