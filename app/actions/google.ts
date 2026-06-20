"use server";

import { createClient } from "@/lib/supabase/server";
import { getGoogleStatus, disconnectGoogle, googleConfigured } from "@/lib/google";
import { getIsTester } from "@/lib/db/profile";
import { hasFeature } from "@/lib/feature-flags";

export async function getGoogleStatusAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { available: false, connected: false, email: null as string | null };
  const [status, isTester] = await Promise.all([getGoogleStatus(user.id), getIsTester(user.id)]);
  // available = feature habilitada para este usuario Y credenciales configuradas.
  const available = hasFeature("google", { isTester }) && googleConfigured();
  return { available, connected: status.connected, email: status.email };
}

export async function disconnectGoogleAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };
  try {
    await disconnectGoogle(user.id);
    return { ok: true };
  } catch {
    return { error: "No se pudo desconectar" };
  }
}
