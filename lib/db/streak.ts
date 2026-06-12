import { prisma } from "@/lib/prisma";
import { toZonedTime } from "date-fns-tz";
import { ARG_TZ, todayStringArg } from "@/lib/timezone";
import { calculateStreak } from "@/lib/streak-utils";

/**
 * Racha actual del usuario: días ARG consecutivos en los que registró al menos
 * un movimiento (por fecha de carga). El motor de hábito del dashboard.
 */
export async function getStreak(userId: string): Promise<number> {
  // Con el último ~año de movimientos alcanza para cualquier racha real.
  const txs = await prisma.transaction.findMany({
    where: { userId },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const activeDays = new Set(
    txs.map((t) => toZonedTime(t.createdAt, ARG_TZ).toISOString().slice(0, 10))
  );

  return calculateStreak(activeDays, todayStringArg());
}
