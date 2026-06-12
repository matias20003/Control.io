import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResend, FROM } from "@/lib/email/client";
import { buildReactivationHtml } from "@/lib/email/reactivation";
import { sendPushToUser } from "@/lib/push/send";

// Vercel Cron diario: nudge a usuarios que se registraron y NO cargaron ningún
// movimiento, para llevarlos a su primer "aha". Se envía UNA sola vez por usuario
// (reactivationNudgeAt). Canal principal: email (todos tienen). Push si está suscripto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://controlio.site";
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;

  // Candidatos: registrados hace entre ~20h y 7 días (les dimos un día para
  // arrancar solos, pero no molestamos cuentas muy viejas), que NUNCA cargaron
  // un movimiento y a los que todavía no les mandamos el nudge.
  const candidates = await prisma.profile.findMany({
    where: {
      reactivationNudgeAt: null,
      createdAt: { lte: new Date(now - 20 * HOUR), gte: new Date(now - 7 * 24 * HOUR) },
      transactions: { none: {} },
    },
    select: { id: true, email: true, name: true, whatsappNumber: true },
    take: 100,
  });

  if (!candidates.length) {
    return Response.json({ ok: true, sent: 0, total: 0 });
  }

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

      // Push best-effort (no rompe si no está suscripto).
      sendPushToUser(p.id, {
        title: "¿Arrancamos? 👋",
        body: "Cargá tu primer movimiento en 10 segundos y mirá tu dashboard cobrar vida.",
        url: "/dashboard",
      }).catch(() => {});

      // Marcamos para no volver a enviarle nunca más.
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

  return Response.json({ ok: true, sent, errors, total: candidates.length });
}
