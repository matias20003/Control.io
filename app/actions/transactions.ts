"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactions,
} from "@/lib/db/transactions";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  currency: z.string().min(1),
  description: z.string().optional(),
  date: z.string().min(1, "La fecha es requerida"),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  toAccountId: z.string().optional(),
  notes: z.string().optional(),
});

export async function createTransactionAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = {
    type: formData.get("type") as string,
    amount: formData.get("amount"),
    currency: (formData.get("currency") as string) || "ARS",
    description: (formData.get("description") as string) || undefined,
    date: formData.get("date") as string,
    categoryId: (formData.get("categoryId") as string) || undefined,
    accountId: (formData.get("accountId") as string) || undefined,
    toAccountId: (formData.get("toAccountId") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  };

  const result = createTransactionSchema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  try {
    const tx = await createTransaction(user.id, result.data);
    // Saldo nuevo de la cuenta para mostrarlo en el toast sin hacer otro round-trip.
    let newBalance: number | null = null;
    let accountCurrency: string | null = null;
    if (tx.accountId) {
      const acc = await prisma.account.findFirst({
        where: { id: tx.accountId, userId: user.id },
        select: { balance: true, currency: true },
      });
      if (acc) {
        newBalance = toNum(acc.balance);
        accountCurrency = acc.currency;
      }
    }
    revalidatePath("/movimientos");
    revalidatePath("/dashboard");
    revalidatePath("/cuentas");
    return { success: true, transaction: tx, newBalance, accountCurrency };
  } catch {
    return { error: "Error al crear el movimiento" };
  }
}

export async function updateTransactionAction(transactionId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = {
    type: formData.get("type") as string,
    amount: formData.get("amount"),
    currency: (formData.get("currency") as string) || "ARS",
    description: (formData.get("description") as string) || undefined,
    date: formData.get("date") as string,
    categoryId: (formData.get("categoryId") as string) || undefined,
    accountId: (formData.get("accountId") as string) || undefined,
    toAccountId: (formData.get("toAccountId") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  };

  const result = createTransactionSchema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  try {
    const tx = await updateTransaction(user.id, transactionId, result.data);
    revalidatePath("/movimientos");
    revalidatePath("/dashboard");
    revalidatePath("/cuentas");
    return { success: true, transaction: tx };
  } catch {
    return { error: "Error al actualizar el movimiento" };
  }
}

export async function deleteTransactionAction(transactionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    await deleteTransaction(user.id, transactionId);
    revalidatePath("/movimientos");
    revalidatePath("/dashboard");
    revalidatePath("/cuentas");
    return { success: true };
  } catch {
    return { error: "Error al eliminar el movimiento" };
  }
}

export async function getTransactionsAction(
  month: number,
  year: number,
  filters: { type?: string; accountId?: string; take?: number; skip?: number } = {}
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], total: 0, hasMore: false };

  return getTransactions(user.id, { ...filters, month, year });
}
