import "server-only";
import { prisma } from "@/lib/prisma";
import { summarizeStudyContent, createStudyNote, getDueReviews, markReviewSent, SPACED_INTERVALS } from "@/lib/db/study";
import { sendText } from "@/lib/whatsapp/kapso";
import { sendPushToUser } from "@/lib/push/send";

/** ¿Este usuario (por id) es el dueño (ADMIN_EMAIL)? El estudio es solo para él. */
export async function isStudyOwner(userId: string): Promise<boolean> {
  if (!process.env.ADMIN_EMAIL) return false;
  const p = await prisma.profile.findFirst({
    where: { id: userId, email: process.env.ADMIN_EMAIL },
    select: { id: true },
  });
  return !!p;
}

/** Extrae el texto de un PDF (texto seleccionable; los escaneados no traen texto). */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return (result.text ?? "").trim();
}

export type IngestResult =
  | { ok: true; subject: string; title: string; reviewDates: Date[] }
  | { ok: false; reason: "empty" | "error" };

/**
 * Toma un PDF de estudio, extrae el texto, lo resume con IA, lo guarda como nota
 * y agenda el repaso espaciado. Devuelve datos para el mensaje de confirmación.
 */
export async function ingestStudyPdf(
  userId: string,
  buffer: Buffer,
  hintSubject?: string
): Promise<IngestResult> {
  try {
    const text = await extractPdfText(buffer);
    if (text.length < 40) return { ok: false, reason: "empty" }; // PDF vacío o escaneado
    const { subject, title, summary } = await summarizeStudyContent(text, hintSubject);
    const { reviewDates } = await createStudyNote(userId, {
      subject,
      title,
      summary,
      content: text.slice(0, 20000),
      source: "pdf",
    });
    return { ok: true, subject, title, reviewDates };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Igual pero desde texto (apunte tipeado o audio transcripto). */
export async function ingestStudyText(
  userId: string,
  text: string,
  hintSubject?: string
): Promise<IngestResult> {
  try {
    if (text.trim().length < 20) return { ok: false, reason: "empty" };
    const s = await summarizeStudyContent(text, hintSubject);
    const { reviewDates } = await createStudyNote(userId, {
      subject: s.subject,
      title: s.title,
      summary: s.summary,
      content: text.slice(0, 20000),
      source: "text",
    });
    return { ok: true, subject: s.subject, title: s.title, reviewDates };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Dispara los repasos vencidos: avisa al dueño por WhatsApp + push. Best-effort,
 * para colgar de un cron. Marca cada repaso como enviado.
 */
export async function fireStudyReviews(): Promise<{ sent: number }> {
  const due = await getDueReviews();
  if (!due.length) return { sent: 0 };

  const owner = process.env.ADMIN_EMAIL
    ? await prisma.profile.findFirst({
        where: { email: process.env.ADMIN_EMAIL },
        select: { id: true, whatsappNumber: true },
      })
    : null;
  const wa = process.env.OWNER_WHATSAPP || owner?.whatsappNumber || null;

  let sent = 0;
  for (const r of due) {
    const msg =
      `📖 *Repaso de ${r.subject}*\n${r.title}\n\n` +
      `Dale una leída para fijarlo — es un ratito hoy que te ahorra el atracón antes del parcial 👉 https://controlio.site/estudio`;
    if (wa) await sendText(wa, msg).catch(() => {});
    if (owner?.id) {
      await sendPushToUser(owner.id, { title: `📖 Repaso: ${r.subject}`, body: r.title, url: "/estudio" }).catch(() => {});
    }
    await markReviewSent(r.id);
    sent++;
  }
  return { sent };
}

/** Mensaje de confirmación para WhatsApp tras guardar una nota de estudio. */
export function studySavedMessage(r: { subject: string; title: string }): string {
  const dias = SPACED_INTERVALS.join(", ").replace(/, ([^,]*)$/, " y $1");
  return (
    `📚 *Guardado en Estudio* — ${r.subject}\n*${r.title}*\n\n` +
    `Te armé el resumen (lo ves en *controlio.site/estudio*) y agendé el *repaso espaciado*: ` +
    `te voy a recordar repasarlo a los ${dias} días. Así llegás al parcial sin estudiar todo junto 💪`
  );
}
