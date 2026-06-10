import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORY_COUNT } from "@/lib/db/profile";

export type OnboardingState = {
  hasAccount: boolean;          // creó al menos una cuenta
  hasCustomCategory: boolean;   // agregó al menos una categoría propia
  hasTransaction: boolean;      // cargó al menos un movimiento
  hasPushSubscription: boolean; // activó notificaciones push
  completedCount: number;       // 0..4
  totalSteps: number;           // 4
  isComplete: boolean;          // los 4 pasos cubiertos
};

const TOTAL_STEPS = 4;

/**
 * Detecta el estado del tutorial inicial mirando datos reales del usuario.
 * Pensado para correrse en server components (rápido, counts paralelos).
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const [accounts, transactions, pushSubs, categories] = await Promise.all([
    prisma.account.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId } }),
    prisma.pushSubscription.count({ where: { userId } }).catch(() => 0),
    prisma.category.count({ where: { userId } }),
  ]);

  const hasAccount = accounts > 0;
  const hasTransaction = transactions > 0;
  const hasPushSubscription = pushSubs > 0;
  // Como sembramos categorías por defecto, "tiene categorías" sería siempre
  // true; el indicador real es que agregó alguna propia (supera el default).
  const hasCustomCategory = categories > DEFAULT_CATEGORY_COUNT;

  const completedCount =
    Number(hasAccount) +
    Number(hasCustomCategory) +
    Number(hasTransaction) +
    Number(hasPushSubscription);

  return {
    hasAccount,
    hasCustomCategory,
    hasTransaction,
    hasPushSubscription,
    completedCount,
    totalSteps: TOTAL_STEPS,
    isComplete: completedCount === TOTAL_STEPS,
  };
}
