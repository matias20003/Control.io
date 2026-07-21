import "server-only";
import { prisma } from "@/lib/prisma";
import { fetchRecentEmails } from "@/lib/email/imap";
import { sendText } from "@/lib/whatsapp/kapso";
import { sendPushToUser } from "@/lib/push/send";

// Solo avisamos de correos recibidos en las últimas horas (evita un aluvión de
// correos viejos la primera vez que corre). El cron corre seguido, así que la
// ventana no necesita ser grande.
const RECENT_MS = 6 * 60 * 60 * 1000;

/** Usa la IA para marcar qué correos están relacionados con la facultad (UTN). */
async function detectUtn(emails: { from: string; subject: string }[]): Promise<Set<number>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !emails.length) return new Set();
  const model = process.env.OPENROUTER_MODEL?.split(",")[0]?.trim() || "openai/gpt-4o-mini";
  const list = emails.map((e, i) => `${i}. De: ${e.from} — Asunto: ${e.subject}`).join("\n");
  const system =
    `El usuario estudia en la UTN (Universidad Tecnológica Nacional, Argentina). ` +
    `De la lista de correos, indicá CUÁLES están relacionados con su facultad/universidad: ` +
    `materias, cátedras, exámenes/parciales/finales, inscripciones, cursado, campus o aula virtual, ` +
    `profesores, avisos de la UTN o de una facultad regional. Respondé SOLO JSON: {"utn":[índices]}.`;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: list }],
      }),
    });
    if (!res.ok) return new Set();
    const j = await res.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    return new Set<number>((parsed.utn ?? []).filter((n: unknown) => typeof n === "number"));
  } catch {
    return new Set();
  }
}

/**
 * Vigilante de correos de la facultad (UTN): busca correos nuevos de la UTN en la
 * bandeja del dueño y le manda un aviso por WhatsApp (bot) + push. Deduplica por
 * Message-ID (tabla email_notified). Best-effort: pensado para correr en un cron.
 */
export async function watchUtnEmails(): Promise<{ notified: number; skipped: number }> {
  // Sin casilla configurada, no hay nada que vigilar.
  if (!process.env.GMAIL_IMAP_USER || !process.env.GMAIL_IMAP_PASSWORD) {
    return { notified: 0, skipped: 0 };
  }

  const owner = process.env.ADMIN_EMAIL
    ? await prisma.profile.findFirst({
        where: { email: process.env.ADMIN_EMAIL },
        select: { id: true, whatsappNumber: true },
      })
    : null;
  const ownerWa = process.env.OWNER_WHATSAPP || owner?.whatsappNumber || null;

  const emails = await fetchRecentEmails(20);
  const now = Date.now();
  const recent = emails.filter((e) => now - new Date(e.date).getTime() <= RECENT_MS && e.messageId);
  if (!recent.length) return { notified: 0, skipped: 0 };

  // Sacamos los que ya notificamos.
  const ids = recent.map((e) => e.messageId);
  const already = new Set(
    (await prisma.emailNotified.findMany({ where: { messageId: { in: ids } }, select: { messageId: true } }))
      .map((r) => r.messageId)
  );
  const fresh = recent.filter((e) => !already.has(e.messageId));
  if (!fresh.length) return { notified: 0, skipped: recent.length };

  // La IA decide cuáles son de la facultad.
  const utn = await detectUtn(fresh.map((e) => ({ from: e.from, subject: e.subject })));

  let notified = 0;
  for (let i = 0; i < fresh.length; i++) {
    const e = fresh[i];
    // Marcamos TODOS los frescos como vistos (así no re-evaluamos), pero solo
    // avisamos de los de la UTN.
    await prisma.emailNotified.create({ data: { messageId: e.messageId } }).catch(() => {});
    if (!utn.has(i)) continue;

    const msg =
      `📚 *Nuevo correo de la UTN*\n\n` +
      `*${e.subject}*\n` +
      `De: ${e.from}\n\n` +
      `Revisalo cuando puedas 👉 https://controlio.site/correos`;

    if (ownerWa) await sendText(ownerWa, msg).catch(() => {});
    if (owner?.id) {
      await sendPushToUser(owner.id, {
        title: "📚 Correo de la UTN",
        body: e.subject,
        url: "/correos",
      }).catch(() => {});
    }
    notified++;
  }

  return { notified, skipped: recent.length - fresh.length };
}
