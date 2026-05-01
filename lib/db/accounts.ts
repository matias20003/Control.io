import { prisma } from "@/lib/prisma";

export type SerializedAccount = {
  id: string;
  userId: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  createdAt: string;
};

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : parseFloat(String(val));
}

function serialize(a: any): SerializedAccount {
  return {
    id: a.id,
    userId: a.userId,
    name: a.name,
    type: a.type,
    currency: a.currency,
    balance: toNum(a.balance),
    color: a.color,
    icon: a.icon,
    isActive: a.isActive,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
  };
}

export async function getAccounts(userId: string): Promise<SerializedAccount[]> {
  const rows = await prisma.account.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(serialize);
}

export async function createAccount(userId: string, data: {
  name: string; type: string; currency: string; balance: number; color?: string; icon?: string;
}) {
  const row = await prisma.account.create({
    data: {
      userId,
      name: data.name,
      type: data.type as any,
      currency: data.currency,
      balance: data.balance,
      color: data.color ?? null,
      icon: data.icon ?? null,
    },
  });
  return serialize(row);
}

export async function updateAccount(userId: string, accountId: string, data: {
  name?: string; type?: string; currency?: string; balance?: number; color?: string; icon?: string;
}) {
  const row = await prisma.account.update({
    where: { id: accountId, userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type as any }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.balance !== undefined && { balance: data.balance }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.icon !== undefined && { icon: data.icon }),
    },
  });
  return serialize(row);
}

export async function deleteAccount(userId: string, accountId: string) {
  await prisma.account.update({
    where: { id: accountId, userId },
    data: { isActive: false },
  });
}
