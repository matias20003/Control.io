import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { scheduleReminderDelivery } from "@/lib/qstash";

export type SerializedReminder = { id: string; text: string; remindAt: string };

export async function createReminder(
  userId: string,
  data: { text: string; remindAt: Date }
): Promise<SerializedReminder> {
  const row = await prisma.reminder.create({
    data: { userId, text: encrypt(data.text) ?? data.text, remindAt: data.remindAt },
  });
  // Programa el disparo exacto en QStash (no-op si no está configurado).
  await scheduleReminderDelivery(row.id, row.remindAt).catch(() => {});
  return { id: row.id, text: data.text, remindAt: row.remindAt.toISOString() };
}

/** Recordatorios sin enviar cuya hora ya pasó (para el cron de disparo). */
export async function getDueReminders(): Promise<
  { id: string; text: string; userId: string; whatsappNumber: string | null }[]
> {
  const rows = await prisma.reminder.findMany({
    where: { sent: false, remindAt: { lte: new Date() } },
    include: { user: { select: { whatsappNumber: true } } },
    orderBy: { remindAt: "asc" },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    text: decrypt(r.text) ?? r.text,
    userId: r.userId,
    whatsappNumber: r.user.whatsappNumber,
  }));
}

export async function markReminderSent(id: string): Promise<void> {
  await prisma.reminder.update({ where: { id }, data: { sent: true } });
}

/** Próximos recordatorios pendientes de un usuario (para el contexto del bot). */
export async function getPendingReminders(userId: string): Promise<SerializedReminder[]> {
  const rows = await prisma.reminder.findMany({
    where: { userId, sent: false, remindAt: { gte: new Date() } },
    orderBy: { remindAt: "asc" },
    take: 10,
  });
  return rows.map((r) => ({ id: r.id, text: decrypt(r.text) ?? r.text, remindAt: r.remindAt.toISOString() }));
}
