import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { sendPushToUser } from "@/lib/push/send";
import { sendText } from "@/lib/whatsapp/kapso";
import { markReminderSent } from "@/lib/db/reminders";

// QStash pega acá a la hora exacta del recordatorio (con el reminderId en el body).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { reminderId?: string };
  if (!body.reminderId) return Response.json({ ok: true, skipped: "no-id" });

  const r = await prisma.reminder.findUnique({
    where: { id: body.reminderId },
    include: { user: { select: { whatsappNumber: true } } },
  });
  // Idempotente: si ya se mandó (o no existe), no duplicamos.
  if (!r || r.sent) return Response.json({ ok: true, skipped: "done" });

  const text = decrypt(r.text) ?? r.text;
  let delivered = false;

  if (r.user.whatsappNumber) {
    try {
      await sendText(r.user.whatsappNumber, `⏰ *Recordatorio:* ${text}`);
      delivered = true;
    } catch {
      // fuera de la ventana de 24h → push
    }
  }
  if (!delivered) {
    const n = await sendPushToUser(r.userId, { title: "⏰ Recordatorio", body: text, url: "/dashboard" }).catch(() => 0);
    delivered = (n ?? 0) > 0;
  }

  await markReminderSent(r.id).catch(() => {});
  return Response.json({ ok: true, delivered });
}
