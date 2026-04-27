"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createDebt, payDebt, deleteDebt } from "@/lib/db/debts";
import { z } from "zod";

const createSchema = z.object({
  direction: z.enum(["I_OWE", "THEY_OWE"]),
  personName: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  totalAmount: z.coerce.number().positive("El monto debe ser positivo"),
  currency: z.string().min(1),
  dueDate: z.string().optional(),
});

export async function createDebtAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = {
    direction: formData.get("direction"),
    personName: formData.get("personName"),
    description: formData.get("description") || undefined,
    totalAmount: formData.get("totalAmount"),
    currency: formData.get("currency"),
    dueDate: formData.get("dueDate") || undefined,
  };

  const result = createSchema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  try {
    const debt = await createDebt(user.id, result.data);
    revalidatePath("/deudas");
    return { success: true, debt };
  } catch {
    return { error: "Error al crear la deuda" };
  }
}

export async function payDebtAction(debtId: string, amount: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    const debt = await payDebt(user.id, debtId, amount);
    revalidatePath("/deudas");
    return { success: true, debt };
  } catch {
    return { error: "Error al registrar el pago" };
  }
}

export async function deleteDebtAction(debtId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    await deleteDebt(user.id, debtId);
    revalidatePath("/deudas");
    return { success: true };
  } catch {
    return { error: "Error al eliminar la deuda" };
  }
}
