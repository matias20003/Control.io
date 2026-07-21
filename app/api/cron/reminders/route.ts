import { NextRequest } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { getDueReminders, markReminderSent } from "@/lib/db/reminders";
import { fireDueRecurringReminders } from "@/lib/db/recurring-reminders";
import { fireStudyReviews } from "@/lib/study/ingest";
import { sendPushToUser } from "@/lib/push/send";
import { sendText } from "@/lib/whatsapp/kapso";

// Dispara los recordatorios cuya hora ya llegó. Pensado para correr cada minuto
// (precisión de "en 5 min"). En Vercel Hobby no hay cron por minuto, así que lo
// llama un cron externo gratis (ej: cron-job.org) con Authorization: Bearer.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Auth exigida en todo ambiente (sin atajo por NODE_ENV).
  return bearerMatches(req.headers.get("authorization"), secret);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const due = await getDueReminders();
  let sent = 0;

  for (const r of due) {
    let delivered = false;

    // WhatsApp es el mejor canal para un recordatorio. Como recién lo creó por
    // el bot, suele estar dentro de la ventana de 24h de Meta y entra.
    if (r.whatsappNumber) {
      try {
        await sendText(r.whatsappNumber, `⏰ *Recordatorio:* ${r.text}`);
        delivered = true;
      } catch {
        // fuera de la ventana o error → cae a push
      }
    }

    if (!delivered) {
      const n = await sendPushToUser(r.userId, {
        title: "⏰ Recordatorio",
        body: r.text,
        url: "/dashboard",
      }).catch(() => 0);
      delivered = (n ?? 0) > 0;
    }

    // Lo marcamos enviado siempre (aunque no haya canal) para no reintentar al
    // infinito un recordatorio de un usuario sin WhatsApp ni push.
    await markReminderSent(r.id).catch(() => {});
    if (delivered) sent++;
  }

  // Recordatorios RECURRENTES (lun-vie a tal hora, etc.): disparan los que
  // coinciden con la hora ARG actual. Best-effort, no frena a los de una vez.
  const recurring = await fireDueRecurringReminders().catch(() => ({ fired: 0 }));

  // Repasos espaciados de Estudio que vencieron hoy. Best-effort.
  const study = await fireStudyReviews().catch(() => ({ sent: 0 }));

  return Response.json({ ok: true, due: due.length, sent, recurring: recurring.fired, study: study.sent });
}
