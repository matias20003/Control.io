"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createOrUpdateBudget, deleteBudget } from "@/lib/db/budgets";
import { z } from "zod";

const schema = z.object({
  categoryId: z.string().min(1, "La categoría es requerida"),
  amount: z.coerce.number().positive("El monto debe ser positivo"),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  alertAt: z.coerce.number().int().min(1).max(100).optional(),
});

export async function createOrUpdateBudgetAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = {
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    month: formData.get("month"),
    year: formData.get("year"),
    alertAt: formData.get("alertAt") || undefined,
  };

  const result = schema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  try {
    await createOrUpdateBudget(user.id, { ...result.data, currency: "ARS" });
    revalidatePath("/presupuestos");
    return { success: true };
  } catch {
    return { error: "Error al guardar el presupuesto" };
  }
}

export async function deleteBudgetAction(budgetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    await deleteBudget(user.id, budgetId);
    revalidatePath("/presupuestos");
    return { success: true };
  } catch {
    return { error: "Error al eliminar el presupuesto" };
  }
}
