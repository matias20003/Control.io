import { toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { ARG_TZ } from "@/lib/timezone";
import { getResend, FROM } from "@/lib/email/client";
import { sendPushToUser } from "@/lib/push/send";
import { sendDocument } from "@/lib/whatsapp/kapso";
import {
  buildPeriodicSnapshot,
  closedPeriod,
  createReportDelivery,
  frequencyLabel,
  type ReportFrequency,
} from "@/lib/reports/periodic";
import { renderPeriodicReportPdf } from "@/lib/reports/pdf";

function due(frequency: ReportFrequency, configuredDay: number | null, now: Date) {
  const day = configuredDay ?? 1;
  if (frequency === "WEEKLY") return now.getDay() === day;
  if (frequency === "FORTNIGHTLY") {
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return day === 15
      ? now.getDate() === 15 || now.getDate() === last
      : now.getDate() === 1 || now.getDate() === 16;
  }
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() === Math.min(day, last);
}

export async function deliverDuePeriodicReports(options: {
  hour?: number;
  now?: Date;
} = {}) {
  const nowArg = toZonedTime(options.now ?? new Date(), ARG_TZ);
  const hour = options.hour ?? nowArg.getHours();
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const appUrl = (configuredUrl.startsWith("https://")
    ? configuredUrl
    : "https://controlio.site").replace(/\/+$/, "");

  const candidates = await prisma.profile.findMany({
    where: {
      weeklyReportEnabled: true,
      weeklyReportHour: hour,
    },
    select: {
      id: true,
      name: true,
      email: true,
      whatsappNumber: true,
      weeklyReportDay: true,
      reportFrequency: true,
      reportNotifyApp: true,
      reportNotifyWhatsapp: true,
      reportNotifyEmail: true,
    },
  });

  let delivered = 0;
  let whatsapp = 0;
  let skipped = 0;
  let errors = 0;

  for (const profile of candidates) {
    const frequency = profile.reportFrequency as ReportFrequency;
    if (!due(frequency, profile.weeklyReportDay, nowArg)) continue;
    const { start, end } = closedPeriod(frequency, nowArg);
    const exists = await prisma.reportDelivery.findFirst({
      where: { userId: profile.id, frequency, periodStart: start, periodEnd: end },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      continue;
    }

    try {
      const snapshot = await buildPeriodicSnapshot(
        profile.id,
        profile.name || profile.email.split("@")[0],
        frequency,
        start,
        end,
      );
      const delivery = await createReportDelivery(profile.id, snapshot);
      const pdfUrl = `${appUrl}/api/reports/pdf/${delivery.publicToken}`;
      const label = frequencyLabel(frequency);
      const filename = `controlio-reporte-${label}-${start.toISOString().slice(0, 10)}.pdf`;
      const caption = `📊 Tu reporte ${label} y las tendencias del período ya están listos.`;

      if (profile.reportNotifyApp) {
        await sendPushToUser(profile.id, {
          title: `Reporte ${label} listo`,
          body: delivery.summary,
          url: pdfUrl,
        }).catch(() => 0);
      }
      if (profile.reportNotifyWhatsapp && profile.whatsappNumber) {
        await sendDocument(profile.whatsappNumber, pdfUrl, filename, caption);
        whatsapp++;
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

  return { delivered, whatsapp, skipped, errors, candidates: candidates.length, hour };
}
