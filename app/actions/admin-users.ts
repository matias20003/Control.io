"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserDetail, type UserDetail } from "@/lib/db/admin-users";

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
}

export async function getUserDetailAction(userId: string): Promise<{ detail?: UserDetail; error?: string }> {
  if (!(await requireAdmin())) return { error: "No autorizado" };
  try {
    const detail = await getUserDetail(userId);
    if (!detail) return { error: "Usuario no encontrado" };
    return { detail };
  } catch {
    return { error: "No se pudo cargar el detalle" };
  }
}
