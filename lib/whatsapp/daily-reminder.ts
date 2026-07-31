import { prisma } from "@/lib/prisma";
import { sendText } from "@/lib/whatsapp/kapso";
import { getDailyReminderRecipients } from "@/lib/db/profile";
import { getStreak } from "@/lib/db/streak";
import { sendPushToUser } from "@/lib/push/send";
import { startOfTodayArg } from "@/lib/timezone";
import { claimInsightDelivery, getProactiveInsights, type ProactiveInsight } from "@/lib/whatsapp/insights";

const MESSAGE =
  "📝 ¿Registraste tus gastos de hoy?\n\nTe toma menos de 1 minuto y mantenés todo bajo control. Mandame un texto, un audio o la foto de un ticket 👇";

// Si tiene una racha viva, el recordatorio tira de ese hilo ("no la cortes").
function streakMessage(streak: number): string {
  return `🔥 ¡Llevás una racha de ${streak} días registrando! No la cortes 💪\n\n¿Registraste tus gastos de hoy? Mandame un texto, un audio o la foto de un ticket 👇`;
}

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

    const streak = await getStreak(r.id).catch(() => 0);
    const candidates = await getProactiveInsights(r.id).catch(() => []);
    let insight: ProactiveInsight | undefined = candidates[0];
    if (insight && !(await claimInsightDelivery(r.id, insight).catch(() => false))) insight = undefined;
    const baseMessage = streak >= 2 ? streakMessage(streak) : MESSAGE;
    const personalizedMessage = insight
      ? `${baseMessage}\n\n💡 *${insight.title}*\n${insight.message}`
      : baseMessage;

    // 1) WhatsApp primero (si está vinculado). Si Meta lo entrega, listo: no
    //    mandamos también el push para no duplicar.
    if (r.whatsappNumber) {
      try {
        await sendText(r.whatsappNumber, personalizedMessage);
        sent++;
        continue;
      } catch {
        // Fuera de la ventana de 24hs o error: caemos al push.
      }
    }

    // 2) Fallback: notificación push (no tiene el límite de 24h de WhatsApp).
    const delivered = await sendPushToUser(r.id, {
      title: "📝 ¿Registraste tus gastos de hoy?",
      body: streak >= 2
        ? `🔥 Llevás ${streak} días de racha. ¡No la cortes!`
        : "Te toma menos de 1 minuto. Tocá para cargar.",
      url: "/dashboard",
    }).catch(() => 0);

    if (delivered > 0) sent++;
    else failed++; // ni WhatsApp ni push: el usuario no tiene canal alcanzable
  }

  return { sent, skipped, failed };
}

/**
 * Envía el recordatorio a UN usuario en el momento (para el botón "Probar
 * ahora"). Ignora la regla de "ya cargó hoy". Devuelve si WhatsApp salió y por
 * qué falló si no (ej. fuera de la ventana de 24h de Meta).
 */
export async function sendReminderToUser(
  userId: string
): Promise<{ ok: boolean; channel?: "whatsapp" | "push"; error?: string }> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { whatsappNumber: true },
  });

  const streak = await getStreak(userId).catch(() => 0);

  // 1) WhatsApp primero.
  if (profile?.whatsappNumber) {
    try {
      await sendText(profile.whatsappNumber, streak >= 2 ? streakMessage(streak) : MESSAGE);
      return { ok: true, channel: "whatsapp" };
    } catch {
      // Fuera de la ventana de 24h o error: caemos al push.
    }
  }

  // 2) Fallback: notificación push.
  const delivered = await sendPushToUser(userId, {
    title: "📝 ¿Registraste tus gastos de hoy?",
    body: streak >= 2 ? `🔥 Llevás ${streak} días de racha. ¡No la cortes!` : "Te toma menos de 1 minuto. Tocá para cargar.",
    url: "/dashboard",
  }).catch(() => 0);

  if (delivered > 0) return { ok: true, channel: "push" };

  return {
    ok: false,
    error: profile?.whatsappNumber
      ? "WhatsApp no se pudo entregar (suele ser por la ventana de 24h: escribile algo al bot primero) y no tenés notificaciones push activas."
      : "No tenés WhatsApp vinculado ni notificaciones push activas.",
  };
}
