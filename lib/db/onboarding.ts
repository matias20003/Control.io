import { prisma } from "@/lib/prisma";

export type OnboardingState = {
  hasAccount: boolean;          // creó al menos una cuenta
  hasTransaction: boolean;      // cargó al menos un movimiento
  hasPushSubscription: boolean; // activó notificaciones push
  completedCount: number;       // 0..3
  totalSteps: number;           // 3
  isComplete: boolean;          // los 3 pasos cubiertos
};

const TOTAL_STEPS = 3;

/**
 * Detecta el estado del tutorial inicial mirando datos reales del usuario.
 * Pensado para correrse en server components (rápido, 3 counts paralelos).
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const [accounts, transactions, pushSubs] = await Promise.all([
    prisma.account.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId } }),
    prisma.pushSubscription.count({ where: { userId } }).catch(() => 0),
  ]);

  const hasAccount = accounts > 0;
  const hasTransaction = transactions > 0;
  const hasPushSubscription = pushSubs > 0;

  const completedCount =
    Number(hasAccount) + Number(hasTransaction) + Number(hasPushSubscription);

  return {
    hasAccount,
    hasTransaction,
    hasPushSubscription,
    completedCount,
    totalSteps: TOTAL_STEPS,
    isComplete: completedCount === TOTAL_STEPS,
  };
}
