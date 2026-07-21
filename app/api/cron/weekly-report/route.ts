import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResend, FROM } from "@/lib/email/client";
import { getWeeklyData, buildWeeklyReportHtml } from "@/lib/email/weekly-report";
import { startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { nowArgParts } from "@/lib/timezone";

// Vercel Cron: cada hora (0 * * * *). En cada corrida envía el reporte solo a
// los usuarios cuyo día+hora configurados (en horario ARG) coinciden con ahora.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Auth exigida en todo ambiente (sin atajo por NODE_ENV).
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://control.io";

  // Día y hora actuales en Argentina: solo enviamos a quien configuró este slot.
  const { weekday, hour } = nowArgParts();

  // Semana anterior (lunes – domingo)
  const now = new Date();
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  const profiles = await prisma.profile.findMany({
    where: {
      weeklyReportEnabled: true,
      weeklyReportDay: weekday,
      weeklyReportHour: hour,
    },
    select: { id: true, email: true, name: true },
  });

  if (!profiles.length) {
    return Response.json({ ok: true, sent: 0, total: 0, slot: { weekday, hour } });
  }

  let sent = 0;
  let errors = 0;

  for (const profile of profiles) {
    try {
      const data = await getWeeklyData(profile.id, lastWeekStart, lastWeekEnd);

      // Skip if no activity at all this week
      if (data.income === 0 && data.expense === 0) continue;

      const html = buildWeeklyReportHtml({
        name: profile.name || profile.email.split("@")[0],
        weekStart: lastWeekStart,
        weekEnd: lastWeekEnd,
        data,
        appUrl,
      });

      const { error } = await getResend().emails.send({
        from: FROM,
        to: profile.email,
        subject: `📊 Tu reporte semanal — control.io`,
        html,
      });
      // El SDK de Resend NO lanza excepción ante un error de la API (dominio sin
      // verificar, rate limit, destinatario inválido): lo devuelve en `error`.
      if (error) throw new Error(typeof error === "string" ? error : (error.message ?? "Resend error"));

      sent++;
    } catch (err) {
      console.error(`Error sending report to ${profile.email}:`, err);
      errors++;
    }
  }

  return Response.json({ ok: true, sent, errors, total: profiles.length, slot: { weekday, hour } });
}
