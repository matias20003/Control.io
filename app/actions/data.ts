"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function deleteAllDataAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    // Order matters: delete children before parents
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { userId: user.id } }),
      prisma.creditPurchase.deleteMany({ where: { userId: user.id } }),
      prisma.debt.deleteMany({ where: { userId: user.id } }),
      prisma.budget.deleteMany({ where: { userId: user.id } }),
      prisma.recurringTransaction.deleteMany({ where: { userId: user.id } }),
      prisma.investment.deleteMany({ where: { userId: user.id } }),
      prisma.goal.deleteMany({ where: { userId: user.id } }),
      prisma.pushSubscription.deleteMany({ where: { userId: user.id } }),
      prisma.account.deleteMany({ where: { userId: user.id } }),
      prisma.category.deleteMany({ where: { userId: user.id } }),
    ]);

    revalidatePath("/", "layout");
    return { success: true };
  } catch {
    return { error: "Error al eliminar los datos" };
  }
}
