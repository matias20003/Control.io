import "server-only";
import { ImapFlow } from "imapflow";

export type InboxEmail = {
  uid: number;
  messageId: string; // Message-ID RFC822 (para abrir el correo exacto en Gmail)
  from: string;
  fromAddress: string;
  subject: string;
  date: string; // ISO
  seen: boolean;
};

/**
 * Trae los últimos `limit` correos de la bandeja de entrada por IMAP.
 * Usa GMAIL_IMAP_USER + GMAIL_IMAP_PASSWORD (App Password de Gmail). No requiere
 * OAuth ni verificación de Google porque es un login directo al protocolo IMAP
 * — pensado para la casilla del dueño (admin), no para usuarios finales.
 */
export async function fetchRecentEmails(limit = 25): Promise<InboxEmail[]> {
  const user = process.env.GMAIL_IMAP_USER;
  const pass = process.env.GMAIL_IMAP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Falta configurar GMAIL_IMAP_USER / GMAIL_IMAP_PASSWORD (App Password).");
  }

  const client = new ImapFlow({
    host: process.env.IMAP_HOST ?? "imap.gmail.com",
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, "") },
    logger: false,
  });

  await client.connect();
  const out: InboxEmail[] = [];
  const lock = await client.getMailboxLock("INBOX");
  try {
    const total = client.mailbox && typeof client.mailbox !== "boolean" ? client.mailbox.exists : 0;
    if (total > 0) {
      const from = Math.max(1, total - limit + 1);
      for await (const m of client.fetch(`${from}:*`, { uid: true, envelope: true, flags: true })) {
        const f = m.envelope?.from?.[0];
        out.push({
          uid: m.uid,
          messageId: (m.envelope?.messageId || "").replace(/^<|>$/g, ""),
          from: f?.name || f?.address || "?",
          fromAddress: f?.address || "",
          subject: m.envelope?.subject || "(sin asunto)",
          date: (m.envelope?.date ?? new Date()).toISOString(),
          seen: m.flags?.has("\\Seen") ?? false,
        });
      }
    }
  } finally {
    lock.release();
  }
  await client.logout();
  return out.reverse(); // más nuevos primero
}
