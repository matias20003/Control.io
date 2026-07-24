"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { setTicketStatus } from "@/lib/db/support";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

export async function setTicketStatusAction(id: string, resolved: boolean) {
  const u = await requireAdmin();
  if (!u) return { error: "No autorizado" };
  try {
    await setTicketStatus(id, resolved);
    revalidatePath("/admin");
    return { success: true };
  } catch {
    return { error: "No se pudo actualizar el ticket" };
  }
}
