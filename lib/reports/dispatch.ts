import "server-only";
import { toZonedTime } from "date-fns-tz";
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
import { isReportDue } from "@/lib/reports/schedule";

/**
 * Entrega de los reportes periódicos (semanal, quincenal y mensual).
 *
 * Vivía dentro de la ruta /api/cron/weekly-report, que no la llamaba nadie: no
 * está en los crons de vercel.json (Hobby permite 2 y ya están usados) ni en
 * ningún pinger externo. Resultado: la tabla report_deliveries estaba vacía y
 * el reporte nunca salió, aunque la configuración del usuario estuviera bien.
 *
 * Ahora vive acá y la dispara el cron de recordatorios, que sí corre siempre.
 * Ese cron pasa cada minuto, así que la función tiene que ser idempotente: se
 * apoya en el unique (userId, frequency, periodStart, periodEnd) de
 * ReportDelivery, que se crea ANTES de mandar nada. Si dos corridas se pisan,
 * la segunda choca contra el unique y no manda nada.
 */

export type DispatchResult = {
  delivered: number;
  skipped: number;
  errors: number;
  candidates: number;
  hour: number;
};

/** El error de unique de Prisma: otra corrida ya reclamó este período. */
function isDuplicate(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002";
}

export async function fireReportDeliveries(): Promise<DispatchResult> {
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
    if (!isReportDue(frequency, profile.weeklyReportDay, nowArg)) continue;

    const { start, end } = closedPeriod(frequency);
    const exists = await prisma.reportDelivery.findFirst({
      where: { userId: profile.id, frequency, periodStart: start, periodEnd: end },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }

    try {
      const snapshot = await buildPeriodicSnapshot(
        profile.id,
        profile.name || profile.email.split("@")[0],
        frequency,
        start,
        end,
      );

      // Se reclama el período antes de mandar. Si otra corrida del cron llegó
      // primero, esto tira P2002 y salimos sin haber enviado nada.
      let delivery;
      try {
        delivery = await createReportDelivery(profile.id, snapshot);
      } catch (error) {
        if (isDuplicate(error)) { skipped++; continue; }
        throw error;
      }

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

  return { delivered, skipped, errors, candidates: candidates.length, hour };
}
