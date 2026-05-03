import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getResend, FROM } from "@/lib/email/client";
import { getWeeklyData, buildWeeklyReportHtml } from "@/lib/email/weekly-report";
import { startOfWeek, endOfWeek, subWeeks } from "date-fns";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { name: true, email: true },
  });
  if (!profile) return Response.json({ error: "Perfil no encontrado" }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://control-io.vercel.app";

  // Semana actual (lunes – hoy)
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  try {
    const data = await getWeeklyData(user.id, weekStart, weekEnd);

    if (data.income === 0 && data.expense === 0) {
      return Response.json({ error: "Sin actividad esta semana para reportar" }, { status: 400 });
    }

    const html = buildWeeklyReportHtml({
      name: profile.name || profile.email.split("@")[0],
      weekStart,
      weekEnd,
      data,
      appUrl,
    });

    await getResend().emails.send({
      from: FROM,
      to: profile.email,
      subject: `📊 Tu reporte semanal — control.io`,
      html,
    });

    return Response.json({ ok: true, email: profile.email });
  } catch (err) {
    console.error("send-report error:", err);
    return Response.json({ error: "Error al enviar el reporte" }, { status: 500 });
  }
}
