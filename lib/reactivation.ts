import { prisma } from "@/lib/prisma";
import { getResend, FROM } from "@/lib/email/client";
import { buildReactivationHtml } from "@/lib/email/reactivation";
import { sendPushToUser } from "@/lib/push/send";

/**
 * Envía el nudge de reactivación a usuarios que se registraron y NO cargaron
 * ningún movimiento. Una sola vez por usuario (reactivationNudgeAt). Canal
 * principal: email; push best-effort. Lo usan el cron diario y el botón de admin.
 */
export async function sendReactivationNudges(): Promise<{ sent: number; errors: number; total: number }> {
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://controlio.site";
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;

  const candidates = await prisma.profile.findMany({
    where: {
      reactivationNudgeAt: null,
      createdAt: { lte: new Date(now - 20 * HOUR), gte: new Date(now - 7 * 24 * HOUR) },
      transactions: { none: {} },
    },
    select: { id: true, email: true, name: true },
    take: 100,
  });

  let sent = 0;
  let errors = 0;

  for (const p of candidates) {
    const name = p.name || p.email.split("@")[0];
    try {
      await getResend().emails.send({
        from: FROM,
        to: p.email,
        subject: "¿Arrancamos? Cargá tu primer movimiento en control.io 💸",
        html: buildReactivationHtml({ name, appUrl }),
      });

      sendPushToUser(p.id, {
        title: "¿Arrancamos? 👋",
        body: "Cargá tu primer movimiento en 10 segundos y mirá tu dashboard cobrar vida.",
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
    }
  }

  return { sent, errors, total: candidates.length };
}
