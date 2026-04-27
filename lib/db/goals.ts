import { prisma } from "@/lib/prisma";

export type SerializedGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline: string | null;
  icon: string | null;
  color: string | null;
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
    name: g.name,
    targetAmount: target,
    currentAmount: current,
    currency: g.currency,
    deadline:
      g.deadline instanceof Date
        ? g.deadline.toISOString()
        : (g.deadline ?? null),
    icon: g.icon ?? null,
    color: g.color ?? null,
    isCompleted: g.isCompleted,
    percentage,
    createdAt:
      g.createdAt instanceof Date ? g.createdAt.toISOString() : g.createdAt,
  };
}

export async function getGoals(userId: string): Promise<SerializedGoal[]> {
  const rows = await prisma.goal.findMany({
    where: { userId },
    orderBy: [{ isCompleted: "asc" }, { createdAt: "desc" }],
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
  }
): Promise<SerializedGoal> {
  const row = await prisma.goal.create({
    data: {
      userId,
      name: data.name,
      targetAmount: data.targetAmount,
      currency: data.currency,
      currentAmount: data.currentAmount ?? 0,
      deadline: data.deadline ? new Date(data.deadline) : null,
      icon: data.icon || null,
      color: data.color || null,
    },
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
    where: { id: goalId },
    data: { currentAmount: newAmount, isCompleted },
  });
  return serialize(row);
}

export async function deleteGoal(
  userId: string,
  goalId: string
): Promise<void> {
  await prisma.goal.delete({ where: { id: goalId, userId } });
}
