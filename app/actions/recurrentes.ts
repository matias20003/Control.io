"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  createRecurrente,
  toggleRecurrente,
  deleteRecurrente,
} from "@/lib/db/recurrentes";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().positive("El monto debe ser positivo"),
  currency: z.string().min(1),
  description: z.string().min(1, "La descripción es requerida"),
  categoryId: z.string().optional(),
  frequency: z.enum([
    "DAILY",
    "WEEKLY",
    "BIWEEKLY",
    "MONTHLY",
    "QUARTERLY",
    "YEARLY",
  ]),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  startDate: z.string().min(1, "La fecha de inicio es requerida"),
  endDate: z.string().optional(),
});

export async function createRecurrenteAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = {
    type: formData.get("type"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId") || undefined,
    frequency: formData.get("frequency"),
    dayOfMonth: formData.get("dayOfMonth") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
  };

  const result = schema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  try {
    const rec = await createRecurrente(user.id, result.data);
    revalidatePath("/recurrentes");
    return { success: true, recurrente: rec };
  } catch {
    return { error: "Error al crear el recurrente" };
  }
}

export async function toggleRecurrenteAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    const rec = await toggleRecurrente(user.id, id);
    revalidatePath("/recurrentes");
    return { success: true, recurrente: rec };
  } catch {
    return { error: "Error al actualizar" };
  }
}

export async function deleteRecurrenteAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    await deleteRecurrente(user.id, id);
    revalidatePath("/recurrentes");
    return { success: true };
  } catch {
    return { error: "Error al eliminar" };
  }
}
