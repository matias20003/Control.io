import "server-only";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { ARG_TZ } from "@/lib/timezone";
import { getResend, FROM } from "@/lib/email/client";
import { sendPushToUser } from "@/lib/push/send";
import { isOutsideServiceWindow, sendDocument, sendDocumentById, sendDocumentTemplate, uploadMedia } from "@/lib/whatsapp/kapso";
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
  /** Entregas cuyo PDF no era descargable: no se adjunto por WhatsApp. */
  broken: number;
  /** Fuera de la ventana de 24h de Meta: no es una falla, es la regla. */
  outsideWindow: number;
  candidates: number;
  hour: number;
};

/** El error de unique de Prisma: otra corrida ya reclamó este período. */
function isDuplicate(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002";
}

/**
 * ¿La URL devuelve un PDF de verdad?
 *
 * Meta descarga el documento por su cuenta, sin cookies, y adjunta lo que le
 * responda el server. Cuando la ruta no era pública, el proxy la mandaba a
 * /login y el usuario recibía la pantalla de login como si fuera su reporte.
 * Chequear antes de mandar convierte ese error silencioso en un log, y de paso
 * despierta la función para que la descarga de Meta no arranque en frío.
 *
 * redirect "manual" es lo importante: un 3xx acá significa exactamente ese bug.
 */
async function servesPdf(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "manual" });
    if (!response.ok) return false;
    return (response.headers.get("content-type") ?? "").includes("application/pdf");
  } catch {
    return false;
  }
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
  let broken = 0;
  let outsideWindow = 0;

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

      // Los tres canales van por separado a propósito. Antes compartían un
      // try: si Meta rechazaba el documento (típico fuera de la ventana de 24h),
      // se cortaba todo y el email tampoco salía. Un canal caído no puede
      // llevarse puestos a los otros.
      const wantsPdf = (profile.reportNotifyWhatsapp && !!profile.whatsappNumber) || profile.reportNotifyEmail;
      const pdf = wantsPdf ? Buffer.from(await renderPeriodicReportPdf(snapshot)) : null;

      if (profile.reportNotifyApp) {
        await sendPushToUser(profile.id, { title: `Reporte ${label} listo`, body: delivery.summary, url: pdfUrl })
          .catch((error) => { console.error("[periodic-report] push", error); return 0; });
      }

      if (profile.reportNotifyWhatsapp && profile.whatsappNumber && pdf) {
        try {
          // Se suben los bytes en vez de pasarle un link a Meta: así no depende
          // de que la URL sea alcanzable ni de qué le responda el server.
          const mediaId = await uploadMedia(pdf, filename, "application/pdf");
          await sendDocumentById(profile.whatsappNumber, mediaId, filename, caption);
        } catch (uploadError) {
          if (isOutsideServiceWindow(uploadError)) {
            // Fuera de las 24h solo entran plantillas aprobadas. Si hay una
            // configurada con header de documento, el PDF llega igual; si no,
            // queda para push/email y se cuenta aparte (no es una falla, es la
            // regla de la plataforma).
            const template = process.env.WHATSAPP_REPORT_TEMPLATE;
            let sentByTemplate = false;
            if (template) {
              try {
                const mediaId = await uploadMedia(pdf, filename, "application/pdf");
                await sendDocumentTemplate(
                  profile.whatsappNumber,
                  template,
                  process.env.WHATSAPP_REPORT_TEMPLATE_LANG ?? "es",
                  mediaId,
                  filename,
                  [profile.name || profile.email.split("@")[0], label],
                );
                sentByTemplate = true;
              } catch (templateError) {
                console.error("[periodic-report] plantilla de reporte", templateError);
              }
            }
            if (!sentByTemplate) {
              outsideWindow++;
              console.warn(`[periodic-report] ${profile.id} fuera de la ventana de 24h de WhatsApp`);
            }
          } else {
            // Kapso podría no proxear la subida de media. Caemos al link, que
            // ahora sí es alcanzable, pero solo si devuelve un PDF de verdad.
            console.warn("[periodic-report] subida directa falló, probando por link", uploadError);
            try {
              if (await servesPdf(pdfUrl)) {
                await sendDocument(profile.whatsappNumber, pdfUrl, filename, caption);
              } else {
                broken++;
                console.error(`[periodic-report] ${pdfUrl} no devuelve un PDF; no se adjunta`);
              }
            } catch (linkError) {
              if (isOutsideServiceWindow(linkError)) outsideWindow++;
              else { broken++; console.error("[periodic-report] whatsapp", linkError); }
            }
          }
        }
      }

      if (profile.reportNotifyEmail && pdf) {
        try {
          const { error } = await getResend().emails.send({
            from: FROM,
            to: profile.email,
            subject: `Tu reporte ${label} y tendencias - control.io`,
            html: `<p>Hola ${profile.name || ""},</p><p>Tu reporte ${label} ya está listo. Encontrás el PDF adjunto y también podés <a href="${pdfUrl}">abrirlo desde Control.io</a>.</p>`,
            attachments: [{ filename, content: pdf }],
          });
          if (error) throw new Error(error.message);
        } catch (mailError) {
          console.error("[periodic-report] email", mailError);
        }
      }

      delivered++;
    } catch (error) {
      console.error(`[periodic-report] ${profile.id}`, error);
      errors++;
    }
  }

  return { delivered, skipped, errors, broken, outsideWindow, candidates: candidates.length, hour };
}
