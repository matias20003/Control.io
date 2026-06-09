"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getReportPrefs,
  updateReportPrefs,
  getDailyReminderPref,
  setDailyReminderPref,
  getProfileWhatsapp,
  type ReportPrefs,
} from "@/lib/db/profile";

const schema = z.object({
  enabled: z.boolean(),
  day: z.coerce.number().int().min(0).max(6).nullable(),
  hour: z.coerce.number().int().min(0).max(23).nullable(),
});

/** Lee la preferencia de reporte semanal del usuario actual. */
export async function getReportPrefsAction(): Promise<ReportPrefs | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };
  return getReportPrefs(user.id);
}

/** Guarda la preferencia de reporte semanal del usuario actual. */
export async function updateReportPrefsAction(
  input: z.input<typeof schema>
): Promise<{ success: true; prefs: ReportPrefs } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Si está activado, día y hora son obligatorios.
  if (parsed.data.enabled && (parsed.data.day == null || parsed.data.hour == null)) {
    return { error: "Elegí un día y una hora para el reporte." };
  }

  try {
    const prefs = await updateReportPrefs(
      user.id,
      user.email!,
      user.user_metadata?.name as string | undefined,
      parsed.data,
    );
    revalidatePath("/configuracion");
    return { success: true, prefs };
  } catch {
    return { error: "Error al guardar la preferencia" };
  }
}

/** Lee si el recordatorio diario por WhatsApp está activo. */
export async function getDailyReminderPrefAction(): Promise<{ enabled: boolean } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };
  return { enabled: await getDailyReminderPref(user.id) };
}

/** Activa o desactiva el recordatorio diario por WhatsApp del usuario actual. */
export async function updateDailyReminderPrefAction(
  enabled: boolean,
): Promise<{ success: true; enabled: boolean } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  // Sin número vinculado no hay a dónde enviar el recordatorio.
  if (enabled) {
    const wa = await getProfileWhatsapp(user.id);
    if (!wa) return { error: "Primero vinculá tu número de WhatsApp." };
  }

  try {
    const saved = await setDailyReminderPref(
      user.id,
      user.email!,
      user.user_metadata?.name as string | undefined,
      enabled,
    );
    revalidatePath("/configuracion");
    return { success: true, enabled: saved };
  } catch {
    return { error: "Error al guardar la preferencia" };
  }
}
