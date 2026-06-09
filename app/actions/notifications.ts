"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getReportPrefs, updateReportPrefs, type ReportPrefs } from "@/lib/db/profile";

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
