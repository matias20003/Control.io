import { prisma } from "@/lib/prisma";
import { toZonedTime } from "date-fns-tz";
import { ARG_TZ, todayStringArg } from "@/lib/timezone";
import { calculateStreak, calculateLongestStreak } from "@/lib/streak-utils";

/** Set de fechas ARG (YYYY-MM-DD) en las que el usuario registró algún movimiento. */
async function getActiveDays(userId: string): Promise<Set<string>> {
  const txs = await prisma.transaction.findMany({
    where: { userId },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return new Set(
    txs.map((t) => toZonedTime(t.createdAt, ARG_TZ).toISOString().slice(0, 10))
  );
}

/** Racha actual: días ARG consecutivos registrando (motor de hábito). */
export async function getStreak(userId: string): Promise<number> {
  return calculateStreak(await getActiveDays(userId), todayStringArg());
}

/** Racha actual + récord histórico (para el badge y los milestones). */
export async function getStreakInfo(userId: string): Promise<{ current: number; longest: number }> {
  const days = await getActiveDays(userId);
  return {
    current: calculateStreak(days, todayStringArg()),
    longest: calculateLongestStreak(days),
  };
}
