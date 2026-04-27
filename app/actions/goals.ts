"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createGoal, addFundsToGoal, deleteGoal } from "@/lib/db/goals";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  targetAmount: z.coerce.number().positive("El objetivo debe ser positivo"),
  currency: z.string().min(1),
  currentAmount: z.coerce.number().optional(),
  deadline: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export async function createGoalAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = {
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    currency: formData.get("currency"),
    currentAmount: formData.get("currentAmount") || undefined,
    deadline: formData.get("deadline") || undefined,
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
  };

  const result = createSchema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  try {
    const goal = await createGoal(user.id, result.data);
    revalidatePath("/metas");
    return { success: true, goal };
  } catch {
    return { error: "Error al crear la meta" };
  }
}

export async function addFundsAction(goalId: string, amount: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  if (amount <= 0) return { error: "El monto debe ser positivo" };

  try {
    const goal = await addFundsToGoal(user.id, goalId, amount);
    revalidatePath("/metas");
    return { success: true, goal };
  } catch {
    return { error: "Error al agregar fondos" };
  }
}

export async function deleteGoalAction(goalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    await deleteGoal(user.id, goalId);
    revalidatePath("/metas");
    return { success: true };
  } catch {
    return { error: "Error al eliminar la meta" };
  }
}
