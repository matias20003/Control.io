import { prisma } from "@/lib/prisma";
import { sendText } from "@/lib/whatsapp/kapso";
import { getDailyReminderRecipients } from "@/lib/db/profile";
import { startOfTodayArg } from "@/lib/timezone";

const MESSAGE =
  "📝 ¿Registraste tus gastos de hoy?\n\nTe toma menos de 1 minuto y mantenés todo bajo control. Mandame un texto, un audio o la foto de un ticket 👇";

/**
 * Envía el recordatorio diario por WhatsApp a quienes lo activaron y tienen
 * número vinculado, salvo que ya hayan registrado algún movimiento hoy.
 *
 * IMPORTANTE (Meta/WhatsApp): es un mensaje proactivo. Sólo se entrega a usuarios
 * dentro de la ventana de 24hs (que escribieron al bot hace menos de 24h). Para los
 * que están fuera, Meta lo rechaza salvo que se use una plantilla aprobada. Por eso
 * los fallos se cuentan pero se ignoran (best-effort) y nunca rompen el cron.
 */
export async function sendDailyReminders(): Promise<{ sent: number; skipped: number; failed: number }> {
  const recipients = await getDailyReminderRecipients();
  if (!recipients.length) return { sent: 0, skipped: 0, failed: 0 };

  const since = startOfTodayArg();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of recipients) {
    // Si ya cargó algo hoy, no lo molestamos.
    const count = await prisma.transaction.count({
      where: { userId: r.id, createdAt: { gte: since } },
    });
    if (count > 0) {
      skipped++;
      continue;
    }

    try {
      await sendText(r.whatsappNumber, MESSAGE);
      sent++;
    } catch {
      // Fuera de la ventana de 24hs o error transitorio: lo ignoramos.
      failed++;
    }
  }

  return { sent, skipped, failed };
}
