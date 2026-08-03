import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { snapshotConversion } from "@/lib/exchange";

/**
 * Ejecución de un movimiento fijo: crea el movimiento real y descuenta/suma en
 * la cuenta elegida.
 *
 * Vive acá y no dentro del cron porque ahora hay tres caminos que lo disparan:
 * el cron diario, el alta con "descontarlo ya" y el botón "registrar pago".
 * Si cada uno armara su propia transacción, el saldo de la cuenta y la nota del
 * movimiento se irían separando entre sí.
 */

export type ExecutableRecurring = {
  id: string;
  userId: string;
  type: string;
  amount: unknown;
  currency: string;
  /** Encriptada, tal como está en la tabla. */
  description: string;
  categoryId: string | null;
  accountId: string | null;
  lastExecuted: Date | null;
  updatedAt: Date;
};

export type ExecuteResult = {
  /** false cuando otro proceso reclamó la misma ejecución primero. */
  executed: boolean;
  /** Descripción en claro, para el push y los toasts. */
  description: string;
};

export const AUTO_NOTE = "✅ Ejecutado automáticamente";
export const MANUAL_NOTE = "✅ Registrado manualmente";
export const FIRST_CHARGE_NOTE = "✅ Primer pago registrado al crearlo";

export async function executeRecurringOnce(
  r: ExecutableRecurring,
  runDate: Date,
  note: string = AUTO_NOTE
): Promise<ExecuteResult> {
  // Validar que la categoría / cuenta siguen siendo del mismo user.
  // Si la cuenta fue borrada dejamos accountId=null para que la tx
  // se cree sin impactar saldos, en vez de fallar el FK.
  let safeCategoryId: string | null = null;
  if (r.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: r.categoryId, userId: r.userId },
      select: { id: true },
    });
    safeCategoryId = cat?.id ?? null;
  }
  let safeAccountId: string | null = null;
  if (r.accountId) {
    const acc = await prisma.account.findFirst({
      where: { id: r.accountId, userId: r.userId },
      select: { id: true },
    });
    safeAccountId = acc?.id ?? null;
  }

  const amountNum = parseFloat(String(r.amount));
  const { amountARS, exchangeRate } = await snapshotConversion(amountNum, r.currency);

  // r.description ya viene encriptado desde la tabla de recurrentes.
  // Lo desencriptamos para reutilizar el mismo nombre que puso el usuario
  // (evita el doble-encriptado que dejaba "enc:..." visible en la lista).
  const plainDescription = decrypt(r.description) ?? r.description;

  // Claim + movimiento + saldo, todo atómico. El claim condicional evita
  // duplicados si Vercel reintenta, si dos invocaciones se superponen, o si el
  // usuario toca "registrar pago" justo cuando corre el cron.
  const executed = await prisma.$transaction(async (tx) => {
    const claim = await tx.recurringTransaction.updateMany({
      where: {
        id: r.id,
        isActive: true,
        lastExecuted: r.lastExecuted,
        updatedAt: r.updatedAt,
      },
      data: { lastExecuted: runDate },
    });
    if (claim.count === 0) return false;

    await tx.transaction.create({
      data: {
        userId: r.userId,
        type: r.type as never,
        amount: r.amount as never,
        currency: r.currency,
        amountARS,
        exchangeRate,
        description: encrypt(plainDescription),
        date: runDate,
        categoryId: safeCategoryId,
        accountId: safeAccountId,
        notes: encrypt(note),
      },
    });
    if (safeAccountId) {
      const delta = r.type === "INCOME" ? amountNum : -amountNum;
      await tx.account.update({
        where: { id: safeAccountId, userId: r.userId },
        data: { balance: { increment: delta } },
      });
    }
    return true;
  });

  return { executed, description: plainDescription };
}
