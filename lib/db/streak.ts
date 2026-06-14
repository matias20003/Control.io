import { prisma } from "@/lib/prisma";
import { toZonedTime } from "date-fns-tz";
import { ARG_TZ, todayStringArg } from "@/lib/timezone";
import { calculateStreak, calculateLongestStreak } from "@/lib/streak-utils";

/** Registra que el usuario estuvo activo HOY (ARG). Idempotente. */
export async function recordActiveDay(userId: string): Promise<void> {
  const today = todayStringArg(); // YYYY-MM-DD (ARG)
  await prisma.$executeRaw`
    INSERT INTO "user_active_days" (user_id, day) VALUES (${userId}, ${today}::date)
    ON CONFLICT DO NOTHING`;
}

/**
 * Días ARG (YYYY-MM-DD) que cuentan para la racha: días con movimiento O días
 * en que el usuario abrió la app. Así un día sin gastos no corta la racha si
 * igual entró a revisar.
 */
async function getActiveDays(userId: string): Promise<Set<string>> {
  const [txs, visits] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.$queryRaw<{ day: Date }[]>`
      SELECT day FROM "user_active_days" WHERE user_id = ${userId} ORDER BY day DESC LIMIT 1000`,
  ]);

  const days = new Set<string>();
  for (const t of txs) days.add(toZonedTime(t.createdAt, ARG_TZ).toISOString().slice(0, 10));
  for (const v of visits) days.add(v.day.toISOString().slice(0, 10));
  return days;
}

/** Racha actual: días ARG consecutivos activo (movimiento o visita). */
export async function getStreak(userId: string): Promise<number> {
  return calculateStreak(await getActiveDays(userId), todayStringArg());
}

/**
 * Racha actual + récord. Lo llama el dashboard, así que ADEMÁS registra la
 * visita de hoy (abrir la app cuenta para la racha).
 */
export async function getStreakInfo(userId: string): Promise<{ current: number; longest: number }> {
  // Persistimos la visita de hoy SIN bloquear el render (fire-and-forget).
  void recordActiveDay(userId).catch(() => {});
  const days = await getActiveDays(userId);
  // Abrir la app cuenta para hoy aunque el insert async todavía no haya impactado.
  days.add(todayStringArg());
  return {
    current: calculateStreak(days, todayStringArg()),
    longest: calculateLongestStreak(days),
  };
}
