import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

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
    name: decrypt(a.name) ?? a.name,
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
      name: encrypt(data.name) ?? data.name,
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
  if (data.currency !== undefined) {
    const current = await prisma.account.findFirst({
      where: { id: accountId, userId },
      select: {
        currency: true,
        _count: { select: { transactionsFrom: true, transactionsTo: true } },
      },
    });
    if (!current) throw new Error("Cuenta no encontrada");
    const hasMovements = current._count.transactionsFrom > 0 || current._count.transactionsTo > 0;
    if (hasMovements && data.currency !== current.currency) {
      throw new Error("No se puede cambiar la moneda de una cuenta con movimientos");
    }
  }
  const row = await prisma.account.update({
    where: { id: accountId, userId },
    data: {
      ...(data.name !== undefined && { name: encrypt(data.name) ?? data.name }),
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

/**
 * Reconstruye el saldo diario (end-of-day) de cada cuenta para los últimos
 * `days` días, hacia atrás desde el saldo actual usando las transacciones.
 * No requiere historial almacenado: se deriva de la tabla de transacciones.
 * Devuelve { [accountId]: number[] } con `days` puntos (más viejo → hoy).
 */
export async function getAccountSparklines(
  userId: string,
  days = 30
): Promise<Record<string, number[]>> {
  const accounts = await prisma.account.findMany({
    where: { userId, isActive: true },
    select: { id: true, balance: true },
  });
  if (accounts.length === 0) return {};

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: start },
      OR: [{ accountId: { not: null } }, { toAccountId: { not: null } }],
    },
    select: { type: true, amount: true, destinationAmount: true, date: true, accountId: true, toAccountId: true },
  });

  // Efecto neto por cuenta y por día dentro de la ventana.
  const effects: Record<string, number[]> = {};
  for (const a of accounts) effects[a.id] = new Array(days).fill(0);

  const dayIdx = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return Math.floor((x.getTime() - start.getTime()) / 86_400_000);
  };

  for (const t of txs) {
    const i = dayIdx(t.date);
    if (i < 0 || i >= days) continue;
    const amt = toNum(t.amount);
    // Cuenta de origen: INCOME suma; EXPENSE y TRANSFER restan.
    if (t.accountId && effects[t.accountId]) {
      effects[t.accountId][i] += t.type === "INCOME" ? amt : -amt;
    }
    // Cuenta destino (solo transferencias): suma.
    if (t.type === "TRANSFER" && t.toAccountId && effects[t.toAccountId]) {
      effects[t.toAccountId][i] += t.destinationAmount == null ? amt : toNum(t.destinationAmount);
    }
  }

  const result: Record<string, number[]> = {};
  for (const a of accounts) {
    const series = new Array(days).fill(0);
    let running = toNum(a.balance); // saldo de hoy (end of today)
    series[days - 1] = running;
    // Retrocedemos: quitar el efecto del día i deja el saldo al cierre de i-1.
    for (let i = days - 1; i >= 1; i--) {
      running = running - effects[a.id][i];
      series[i - 1] = running;
    }
    result[a.id] = series;
  }
  return result;
}
