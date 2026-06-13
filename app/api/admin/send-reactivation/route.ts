import { createClient } from "@/lib/supabase/server";
import { sendReactivationNudges } from "@/lib/reactivation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const { sent, errors, total, lastError } = await sendReactivationNudges();
    return Response.json({
      ok: true,
      sent,
      errors,
      total,
      message:
        total === 0
          ? "No hay inactivos pendientes para reactivar ahora mismo."
          : errors
            ? `Enviados ${sent}, ${errors} con error. Causa: ${lastError ?? "desconocida"}`
            : `Enviado a ${sent} de ${total}. ✅`,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Error interno" }, { status: 500 });
  }
}
