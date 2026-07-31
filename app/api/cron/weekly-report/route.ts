import { NextRequest } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { bearerMatches } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { ARG_TZ } from "@/lib/timezone";
import { getResend, FROM } from "@/lib/email/client";
import { sendPushToUser } from "@/lib/push/send";
import { sendDocument } from "@/lib/whatsapp/kapso";
import {
  buildPeriodicSnapshot, closedPeriod, createReportDelivery, frequencyLabel,
  type ReportFrequency,
} from "@/lib/reports/periodic";
import { renderPeriodicReportPdf } from "@/lib/reports/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && bearerMatches(req.headers.get("authorization"), secret);
}

function due(frequency: ReportFrequency, configuredDay: number | null, now: Date) {
  const day = configuredDay ?? 1;
  if (frequency === "WEEKLY") return now.getDay() === day;
  if (frequency === "FORTNIGHTLY") {
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return day === 15 ? now.getDate() === 15 || now.getDate() === last : now.getDate() === 1 || now.getDate() === 16;
  }
  return now.getDate() === Math.min(day, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const nowArg = toZonedTime(new Date(), ARG_TZ);
  const hour = nowArg.getHours();
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  // WhatsApp/Meta necesita una URL HTTPS pública para descargar el documento.
  const appUrl = (configuredUrl.startsWith("https://") ? configuredUrl : "https://controlio.site").replace(/\/+$/, "");
  const candidates = await prisma.profile.findMany({
    where: { weeklyReportEnabled: true, weeklyReportHour: hour },
    select: {
      id: true, name: true, email: true, whatsappNumber: true,
      weeklyReportDay: true, reportFrequency: true, reportNotifyApp: true,
      reportNotifyWhatsapp: true, reportNotifyEmail: true,
    },
  });

  let delivered = 0;
  let skipped = 0;
  let errors = 0;
  for (const profile of candidates) {
    const frequency = profile.reportFrequency as ReportFrequency;
    if (!due(frequency, profile.weeklyReportDay, nowArg)) continue;
    const { start, end } = closedPeriod(frequency);
    const exists = await prisma.reportDelivery.findFirst({
      where: { userId: profile.id, frequency, periodStart: start, periodEnd: end },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }

    try {
      const snapshot = await buildPeriodicSnapshot(profile.id, profile.name || profile.email.split("@")[0], frequency, start, end);
      const delivery = await createReportDelivery(profile.id, snapshot);
      const pdfUrl = `${appUrl}/api/reports/pdf/${delivery.publicToken}`;
      const label = frequencyLabel(frequency);
      const filename = `controlio-reporte-${label}-${start.toISOString().slice(0, 10)}.pdf`;
      const caption = `📊 Tu reporte ${label} y las tendencias del período ya están listos.`;

      if (profile.reportNotifyApp) {
        await sendPushToUser(profile.id, { title: `Reporte ${label} listo`, body: delivery.summary, url: pdfUrl }).catch(() => 0);
      }
      if (profile.reportNotifyWhatsapp && profile.whatsappNumber) {
        await sendDocument(profile.whatsappNumber, pdfUrl, filename, caption);
      }
      if (profile.reportNotifyEmail) {
        const pdf = await renderPeriodicReportPdf(snapshot);
        const { error } = await getResend().emails.send({
          from: FROM,
          to: profile.email,
          subject: `Tu reporte ${label} y tendencias - control.io`,
          html: `<p>Hola ${profile.name || ""},</p><p>Tu reporte ${label} ya está listo. Encontrás el PDF adjunto y también podés <a href="${pdfUrl}">abrirlo desde Control.io</a>.</p>`,
          attachments: [{ filename, content: Buffer.from(pdf) }],
        });
        if (error) throw new Error(error.message);
      }
      delivered++;
    } catch (error) {
      console.error(`[periodic-report] ${profile.id}`, error);
      errors++;
    }
  }
  return Response.json({ ok: true, delivered, skipped, errors, candidates: candidates.length, hour });
}
