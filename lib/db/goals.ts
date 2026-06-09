import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

export type SerializedGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline: string | null;
  icon: string | null;
  color: string | null;
  accountId: string | null;
  accountName: string | null;
  isCompleted: boolean;
  percentage: number;
  createdAt: string;
};

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : parseFloat(String(val));
}

function serialize(g: any): SerializedGoal {
  const target = toNum(g.targetAmount);
  const current = toNum(g.currentAmount);
  const percentage =
    target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  return {
    id: g.id,
    name: decrypt(g.name) ?? g.name,
    targetAmount: target,
    currentAmount: current,
    currency: g.currency,
    deadline:
      g.deadline instanceof Date
        ? g.deadline.toISOString()
        : (g.deadline ?? null),
    icon: g.icon ?? null,
    color: g.color ?? null,
    accountId: g.accountId ?? null,
    accountName: g.account ? (decrypt(g.account.name) ?? g.account.name ?? null) : null,
    isCompleted: g.isCompleted,
    percentage,
    createdAt:
      g.createdAt instanceof Date ? g.createdAt.toISOString() : g.createdAt,
  };
}

const withAccount = { account: { select: { name: true } } } as const;

export async function getGoals(userId: string): Promise<SerializedGoal[]> {
  const rows = await prisma.goal.findMany({
    where: { userId },
    orderBy: [{ isCompleted: "asc" }, { createdAt: "desc" }],
    include: withAccount,
  });
  return rows.map(serialize);
}

export async function createGoal(
  userId: string,
  data: {
    name: string;
    targetAmount: number;
    currency: string;
    currentAmount?: number;
    deadline?: string;
    icon?: string;
    color?: string;
    accountId?: string;
  }
): Promise<SerializedGoal> {
  const row = await prisma.goal.create({
    data: {
      userId,
      name: encrypt(data.name) ?? data.name,
      targetAmount: data.targetAmount,
      currency: data.currency,
      currentAmount: data.currentAmount ?? 0,
      deadline: data.deadline ? new Date(data.deadline) : null,
      icon: data.icon || null,
      color: data.color || null,
      accountId: data.accountId || null,
    },
    include: withAccount,
  });
  return serialize(row);
}

export async function updateGoal(
  userId: string,
  goalId: string,
  data: {
    name?: string;
    targetAmount?: number;
    currency?: string;
    deadline?: string;
    icon?: string;
    color?: string;
    accountId?: string;
  }
): Promise<SerializedGoal> {
  const existing = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!existing) throw new Error("Meta no encontrada");

  const newTarget = data.targetAmount ?? toNum(existing.targetAmount);
  const current = toNum(existing.currentAmount);

  const row = await prisma.goal.update({
    where: { id: goalId, userId },
    data: {
      ...(data.name !== undefined && { name: encrypt(data.name) ?? data.name }),
      ...(data.targetAmount !== undefined && { targetAmount: data.targetAmount }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.deadline !== undefined && { deadline: data.deadline ? new Date(data.deadline) : null }),
      ...(data.icon !== undefined && { icon: data.icon || null }),
      ...(data.color !== undefined && { color: data.color || null }),
      ...(data.accountId !== undefined && { accountId: data.accountId || null }),
      isCompleted: current >= newTarget,
    },
    include: withAccount,
  });
  return serialize(row);
}

export async function addFundsToGoal(
  userId: string,
  goalId: string,
  amount: number
): Promise<SerializedGoal> {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw new Error("Meta no encontrada");

  const current = toNum(goal.currentAmount);
  const target = toNum(goal.targetAmount);
  const newAmount = current + amount;
  const isCompleted = newAmount >= target;

  const row = await prisma.goal.update({
    where: { id: goalId, userId },
    data: { currentAmount: newAmount, isCompleted },
    include: withAccount,
  });
  return serialize(row);
}

export async function deleteGoal(
  userId: string,
  goalId: string
): Promise<void> {
  await prisma.goal.delete({ where: { id: goalId, userId } });
}
