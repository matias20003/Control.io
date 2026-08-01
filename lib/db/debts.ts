import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import type { Debt } from "@/app/generated/prisma/client";

export type SerializedDebt = {
  id: string;
  direction: string;
  personName: string;
  description: string | null;
  totalAmount: number;
  currency: string;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string | null;
  isCompleted: boolean;
  createdAt: string;
};

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : parseFloat(String(val));
}

function serialize(d: any): SerializedDebt {
  const total = toNum(d.totalAmount);
  const paid = toNum(d.paidAmount);
  return {
    id: d.id,
    direction: d.direction,
    personName: decrypt(d.personName) ?? d.personName,
    description: decrypt(d.description) ?? null,
    totalAmount: total,
    currency: d.currency,
    paidAmount: paid,
    remainingAmount: Math.max(total - paid, 0),
    dueDate:
      d.dueDate instanceof Date ? d.dueDate.toISOString() : d.dueDate ?? null,
    isCompleted: d.isCompleted,
    createdAt:
      d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
  };
}

export async function getDebts(userId: string): Promise<SerializedDebt[]> {
  const rows = await prisma.debt.findMany({
    where: { userId },
    orderBy: [{ isCompleted: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(serialize);
}

export async function createDebt(
  userId: string,
  data: {
    direction: "I_OWE" | "THEY_OWE";
    personName: string;
    description?: string;
    totalAmount: number;
    currency: string;
    dueDate?: string;
  }
): Promise<SerializedDebt> {
  const row = await prisma.debt.create({
    data: {
      userId,
      direction: data.direction as any,
      personName: encrypt(data.personName) ?? data.personName,
      description: encrypt(data.description || null),
      totalAmount: data.totalAmount,
      currency: data.currency,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
  });
  return serialize(row);
}

export async function payDebt(
  userId: string,
  debtId: string,
  paymentAmount: number
): Promise<SerializedDebt> {
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error("El pago debe ser mayor a 0");
  }

  // Una sola sentencia evita el clásico read-modify-write: dos pagos que
  // llegan juntos se acumulan, en vez de pisarse entre sí.
  const rows = await prisma.$queryRaw<Debt[]>`
    UPDATE debts
    SET
      "paidAmount" = LEAST("totalAmount", "paidAmount" + ${paymentAmount}::numeric),
      "isCompleted" = ("paidAmount" + ${paymentAmount}::numeric >= "totalAmount"),
      "updatedAt" = NOW()
    WHERE id = ${debtId} AND "userId" = ${userId}
    RETURNING *
  `;
  if (!rows[0]) throw new Error("Deuda no encontrada");
  return serialize(rows[0]);
}

export async function deleteDebt(
  userId: string,
  debtId: string
): Promise<void> {
  await prisma.debt.delete({ where: { id: debtId, userId } });
}
