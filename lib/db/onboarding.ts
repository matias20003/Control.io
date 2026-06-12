import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORY_KEYS } from "@/lib/db/profile";

export type OnboardingState = {
  hasAccount: boolean;          // creó al menos una cuenta
  hasWhatsapp: boolean;         // vinculó su número de WhatsApp
  hasCustomCategory: boolean;   // agregó al menos una categoría propia
  hasTransaction: boolean;      // cargó al menos un movimiento
  hasPushSubscription: boolean; // activó notificaciones push
  completedCount: number;       // 0..5
  totalSteps: number;           // 5
  isComplete: boolean;          // los 5 pasos cubiertos
};

const TOTAL_STEPS = 5;

/**
 * Detecta el estado del tutorial inicial mirando datos reales del usuario.
 * Pensado para correrse en server components (rápido, counts paralelos).
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const [accounts, transactions, pushSubs, cats, profile] = await Promise.all([
    prisma.account.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId } }),
    prisma.pushSubscription.count({ where: { userId } }).catch(() => 0),
    prisma.category.findMany({ where: { userId }, select: { name: true, type: true } }),
    prisma.profile.findUnique({ where: { id: userId }, select: { whatsappNumber: true } }),
  ]);

  const hasAccount = accounts > 0;
  const hasWhatsapp = !!profile?.whatsappNumber;
  const hasTransaction = transactions > 0;
  const hasPushSubscription = pushSubs > 0;
  // Como sembramos categorías por defecto, "tiene categorías" sería siempre
  // true; el indicador real es que tenga alguna PROPIA (nombre/tipo distinto a
  // las default). Robusto aunque borre una default y agregue otra.
  const hasCustomCategory = cats.some(
    (c) => !DEFAULT_CATEGORY_KEYS.has(`${c.type}:${c.name}`)
  );

  const completedCount =
    Number(hasAccount) +
    Number(hasWhatsapp) +
    Number(hasCustomCategory) +
    Number(hasTransaction) +
    Number(hasPushSubscription);

  return {
    hasAccount,
    hasWhatsapp,
    hasCustomCategory,
    hasTransaction,
    hasPushSubscription,
    completedCount,
    totalSteps: TOTAL_STEPS,
    isComplete: completedCount === TOTAL_STEPS,
  };
}
