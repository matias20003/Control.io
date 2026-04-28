import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend, FROM } from "@/lib/email/client";
import { getWeeklyData, buildWeeklyReportHtml } from "@/lib/email/weekly-report";
import { startOfWeek, endOfWeek, subWeeks } from "date-fns";

// Vercel Cron: cada domingo a las 20:00 UTC (17:00 ARG)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://control.io";

  // Semana anterior (lunes – domingo)
  const now = new Date();
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  const profiles = await prisma.profile.findMany({
    select: { id: true, email: true, name: true },
  });

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

      await resend.emails.send({
        from: FROM,
        to: profile.email,
        subject: `📊 Tu reporte semanal — control.io`,
        html,
      });

      sent++;
    } catch (err) {
      console.error(`Error sending report to ${profile.email}:`, err);
      errors++;
    }
  }

  return Response.json({ ok: true, sent, errors, total: profiles.length });
}
