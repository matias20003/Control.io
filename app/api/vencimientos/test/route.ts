import { createClient } from "@/lib/supabase/server";
import { sendDueReminderToUser } from "@/lib/db/due-reminders";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Manda el recordatorio de vencimientos al usuario logueado, ahora ("Probar ahora"). */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const result = await sendDueReminderToUser(user.id);
  return Response.json({
    ok: result.ok,
    message: result.ok
      ? `✅ Te mandé ${result.count} vencimiento${result.count === 1 ? "" : "s"} por push${" "}(y WhatsApp si lo tenés vinculado).`
      : result.error,
  });
}
