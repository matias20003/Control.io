"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  createCreditPurchase,
  payInstallment,
  deleteCreditPurchase,
} from "@/lib/db/credit";
import { z } from "zod";

const createSchema = z.object({
  accountId: z.string().min(1, "La cuenta es requerida"),
  description: z.string().min(1, "La descripción es requerida"),
  totalAmount: z.coerce.number().positive("El monto debe ser positivo"),
  currency: z.string().min(1),
  totalInstallments: z.coerce
    .number()
    .int()
    .min(1)
    .max(60, "Máximo 60 cuotas"),
  firstPaymentDate: z.string().min(1, "La fecha es requerida"),
  categoryId: z.string().optional(),
});

export async function createCreditPurchaseAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = {
    accountId: formData.get("accountId"),
    description: formData.get("description"),
    totalAmount: formData.get("totalAmount"),
    currency: formData.get("currency"),
    totalInstallments: formData.get("totalInstallments"),
    firstPaymentDate: formData.get("firstPaymentDate"),
    categoryId: formData.get("categoryId") || undefined,
  };

  const result = createSchema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  try {
    const purchase = await createCreditPurchase(user.id, result.data);
    revalidatePath("/cuotas");
    return { success: true, purchase };
  } catch {
    return { error: "Error al registrar la compra" };
  }
}

export async function payInstallmentAction(installmentId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    await payInstallment(user.id, installmentId);
    revalidatePath("/cuotas");
    return { success: true };
  } catch {
    return { error: "Error al marcar la cuota" };
  }
}

export async function deleteCreditPurchaseAction(purchaseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    await deleteCreditPurchase(user.id, purchaseId);
    revalidatePath("/cuotas");
    return { success: true };
  } catch {
    return { error: "Error al eliminar la compra" };
  }
}
