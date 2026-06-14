import { createClient } from "@/lib/supabase/server";
import { sendReminderToUser } from "@/lib/whatsapp/daily-reminder";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Manda el recordatorio diario al usuario logueado, ahora (para "Probar ahora"). */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const result = await sendReminderToUser(user.id);
  return Response.json({
    ok: result.ok,
    message: result.ok
      ? "✅ ¡Listo! Revisá tu WhatsApp (y push si lo tenés activo)."
      : `No se pudo enviar: ${result.error}`,
  });
}
