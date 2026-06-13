import { prisma } from "@/lib/prisma";
import { getResend, FROM } from "@/lib/email/client";
import { buildReactivationHtml } from "@/lib/email/reactivation";
import { sendPushToUser } from "@/lib/push/send";

type Candidate = { id: string; email: string; name: string | null; movs: number };

/**
 * Selecciona a quién reactivar. Dos segmentos, con cooldown de 14 días
 * (no re-molestamos a quien ya recibió un nudge hace menos de 14 días):
 *  A) Nunca activó: registrado hace +20h y 0 movimientos.
 *  B) Dormido: tiene movimientos pero su última actividad fue hace +14 días.
 */
export async function getReactivationCandidates(): Promise<(Candidate & { dormant: boolean })[]> {
  const rows = await prisma.$queryRaw<{ id: string; email: string; name: string | null; movs: number }[]>`
    SELECT p.id, p.email, p.name,
      (SELECT count(*) FROM transactions t WHERE t."userId" = p.id)::int movs
    FROM profiles p
    WHERE (p."reactivationNudgeAt" IS NULL OR p."reactivationNudgeAt" < now() - interval '14 days')
      AND p."createdAt" < now() - interval '20 hours'
      AND (
        NOT EXISTS (SELECT 1 FROM transactions t WHERE t."userId" = p.id)
        OR (SELECT max(t."createdAt") FROM transactions t WHERE t."userId" = p.id) < now() - interval '14 days'
      )
    ORDER BY p."createdAt" ASC
    LIMIT 200`;
  return rows.map((r) => ({ ...r, dormant: r.movs > 0 }));
}

/**
 * Envía el nudge de reactivación (email + push best-effort) a los candidatos.
 * Mensaje según segmento: "cargá tu primer movimiento" vs "te extrañamos, volvé".
 * Lo usan el cron diario y el botón "Enviar ahora" del admin.
 */
export async function sendReactivationNudges(): Promise<{ sent: number; errors: number; total: number; lastError?: string }> {
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://controlio.site";
  const candidates = await getReactivationCandidates();

  let sent = 0;
  let errors = 0;
  let lastError: string | undefined;

  for (const p of candidates) {
    const name = p.name || p.email.split("@")[0];
    try {
      // El SDK de Resend NO tira excepción ante errores de API: devuelve
      // { data, error }. Hay que chequear el error a mano, sino marcaríamos
      // como enviados emails que en realidad Resend rechazó (dominio sin
      // verificar, etc.).
      const { error: sendError } = await getResend().emails.send({
        from: FROM,
        to: p.email,
        subject: p.dormant
          ? "Te extrañamos en control.io 👀"
          : "¿Arrancamos? Cargá tu primer movimiento en control.io 💸",
        html: buildReactivationHtml({ name, appUrl, dormant: p.dormant }),
      });
      if (sendError) throw new Error(sendError.message || "Resend rechazó el envío");

      sendPushToUser(p.id, {
        title: p.dormant ? "¡Te extrañamos! 👋" : "¿Arrancamos? 👋",
        body: p.dormant
          ? "Hace un tiempo que no pasás. Entrá y ponete al día con tus números."
          : "Cargá tu primer movimiento en 10 segundos y mirá tu dashboard cobrar vida.",
        url: "/dashboard",
      }).catch(() => {});

      await prisma.profile.update({
        where: { id: p.id },
        data: { reactivationNudgeAt: new Date() },
      });
      sent++;
    } catch (err) {
      console.error(`[reactivation] error con ${p.email}:`, err);
      errors++;
      if (!lastError) lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return { sent, errors, total: candidates.length, lastError };
}
