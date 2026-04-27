import { prisma } from "@/lib/prisma";

export type SerializedInvestment = {
  id: string;
  name: string;
  type: string;
  currency: string;
  amount: number;
  currentValue: number | null;
  ticker: string | null;
  units: number | null;
  purchaseDate: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : parseFloat(String(val));
}

function toNumOrNull(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function serialize(inv: any): SerializedInvestment {
  return {
    id: inv.id,
    name: inv.name,
    type: inv.type,
    currency: inv.currency,
    amount: toNum(inv.amount),
    currentValue: toNumOrNull(inv.currentValue),
    ticker: inv.ticker ?? null,
    units: toNumOrNull(inv.units),
    purchaseDate:
      inv.purchaseDate instanceof Date
        ? inv.purchaseDate.toISOString()
        : inv.purchaseDate,
    notes: inv.notes ?? null,
    isActive: inv.isActive,
    createdAt:
      inv.createdAt instanceof Date
        ? inv.createdAt.toISOString()
        : inv.createdAt,
  };
}

export async function getInvestments(
  userId: string
): Promise<SerializedInvestment[]> {
  const rows = await prisma.investment.findMany({
    where: { userId, isActive: true },
    orderBy: { purchaseDate: "desc" },
  });
  return rows.map(serialize);
}

export async function createInvestment(
  userId: string,
  data: {
    name: string;
    type: string;
    currency: string;
    amount: number;
    currentValue?: number;
    ticker?: string;
    units?: number;
    purchaseDate: string;
    notes?: string;
  }
): Promise<SerializedInvestment> {
  const row = await prisma.investment.create({
    data: {
      userId,
      name: data.name,
      type: data.type as any,
      currency: data.currency,
      amount: data.amount,
      currentValue: data.currentValue ?? null,
      ticker: data.ticker || null,
      units: data.units ?? null,
      purchaseDate: new Date(data.purchaseDate),
      notes: data.notes || null,
    },
  });
  return serialize(row);
}

export async function deleteInvestment(
  userId: string,
  investmentId: string
): Promise<void> {
  await prisma.investment.update({
    where: { id: investmentId, userId },
    data: { isActive: false },
  });
}
