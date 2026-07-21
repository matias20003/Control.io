import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { sendTemplate } from "@/lib/whatsapp/kapso";

// Admin-only: envía la plantilla aprobada de reactivación (WhatsApp HSM) a los
// usuarios que TIENEN WhatsApp vinculado pero están dormidos 7+ días. Es el único
// canal para escribirles fuera de la ventana de 24h. La plantilla debe estar
// APPROVED en Kapso/Meta; si no, Meta rechaza el envío y lo contamos como error.
const TEMPLATE_NAME = "reactivacion";
const TEMPLATE_LANG = "es";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const dormant = await prisma.$queryRaw<{ id: string; name: string | null; email: string; wa: string }[]>`
      SELECT p.id, p.name, p.email, p."whatsappNumber" wa
      FROM profiles p
      WHERE p."whatsappNumber" IS NOT NULL
        AND (SELECT max(t."createdAt") FROM transactions t WHERE t."userId" = p.id)
            < now() - interval '7 days'
      ORDER BY (SELECT max(t."createdAt") FROM transactions t WHERE t."userId" = p.id) NULLS FIRST`;

    let sent = 0;
    let errors = 0;
    let lastError: string | undefined;
    for (const d of dormant) {
      const firstName = (d.name || d.email.split("@")[0]).split(" ")[0];
      try {
        await sendTemplate(d.wa, TEMPLATE_NAME, TEMPLATE_LANG, [firstName]);
        sent++;
      } catch (err) {
        errors++;
        if (!lastError) lastError = err instanceof Error ? err.message : String(err);
      }
    }

    return Response.json({
      ok: true,
      sent,
      errors,
      total: dormant.length,
      message:
        dormant.length === 0
          ? "No hay dormidos con WhatsApp para reactivar ahora."
          : errors
            ? `Enviados ${sent}, ${errors} con error. Causa: ${lastError ?? "desconocida"}`
            : `Plantilla enviada a ${sent} dormido${sent !== 1 ? "s" : ""}. ✅`,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Error interno" }, { status: 500 });
  }
}
