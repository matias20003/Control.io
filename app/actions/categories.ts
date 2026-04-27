"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createCategory, deleteCategory } from "@/lib/db/categories";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  icon: z.string().optional(),
  color: z.string().optional(),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export async function createCategoryAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = {
    name: formData.get("name") as string,
    icon: (formData.get("icon") as string) || undefined,
    color: (formData.get("color") as string) || undefined,
    type: formData.get("type") as "INCOME" | "EXPENSE",
  };

  const result = createCategorySchema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  try {
    const category = await createCategory(user.id, result.data);
    revalidatePath("/configuracion");
    revalidatePath("/movimientos");
    return { success: true, category };
  } catch {
    return { error: "Error al crear la categoría" };
  }
}

export async function deleteCategoryAction(categoryId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    await deleteCategory(user.id, categoryId);
    revalidatePath("/configuracion");
    revalidatePath("/movimientos");
    return { success: true };
  } catch {
    return { error: "Error al eliminar la categoría" };
  }
}
