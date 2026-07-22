import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { nowArgParts, todayStringArg } from "@/lib/timezone";
import { sendPushToUser } from "@/lib/push/send";
import { sendText } from "@/lib/whatsapp/kapso";

export type SerializedRecurringReminder = {
  id: string;
  text: string;
  link: string | null;
  daysOfWeek: number[];
  hour: number;
  minute: number;
  isActive: boolean;
};

function clampDays(days: number[]): number[] {
  return [...new Set(days)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);
}

/** "Hoy ARG" como Date a medianoche UTC del mismo día (para comparar con @db.Date). */
function todayArgDate(): Date {
  return new Date(todayStringArg() + "T00:00:00.000Z");
}

function serialize(row: {
  id: string;
  text: string;
  link: string | null;
  daysOfWeek: number[];
  hour: number;
  minute: number;
  isActive: boolean;
}): SerializedRecurringReminder {
  return {
    id: row.id,
    text: decrypt(row.text) ?? row.text,
    link: row.link ? decrypt(row.link) ?? row.link : null,
    daysOfWeek: row.daysOfWeek,
    hour: row.hour,
    minute: row.minute,
    isActive: row.isActive,
  };
}

export async function listRecurringReminders(
  userId: string
): Promise<SerializedRecurringReminder[]> {
  const rows = await prisma.recurringReminder.findMany({
    where: { userId },
    orderBy: [{ hour: "asc" }, { minute: "asc" }],
  });
  return rows.map(serialize);
}

export async function createRecurringReminder(
  userId: string,
  data: { text: string; daysOfWeek: number[]; hour: number; minute: number; link?: string | null }
): Promise<SerializedRecurringReminder> {
  const link = data.link?.trim() || null;
  const row = await prisma.recurringReminder.create({
    data: {
      userId,
      text: encrypt(data.text) ?? data.text,
      link: link ? encrypt(link) : null,
      daysOfWeek: clampDays(data.daysOfWeek),
      hour: Math.min(23, Math.max(0, Math.trunc(data.hour))),
      minute: Math.min(59, Math.max(0, Math.trunc(data.minute))),
    },
  });
  return serialize(row);
}

export async function updateRecurringReminder(
  userId: string,
  id: string,
  data: { text?: string; daysOfWeek?: number[]; hour?: number; minute?: number; isActive?: boolean; link?: string | null }
): Promise<void> {
  await prisma.recurringReminder.updateMany({
    where: { id, userId },
    data: {
      ...(data.text !== undefined ? { text: encrypt(data.text) ?? data.text } : {}),
      ...(data.link !== undefined ? { link: data.link?.trim() ? encrypt(data.link.trim()) : null } : {}),
      ...(data.daysOfWeek !== undefined ? { daysOfWeek: clampDays(data.daysOfWeek) } : {}),
      ...(data.hour !== undefined ? { hour: Math.min(23, Math.max(0, Math.trunc(data.hour))) } : {}),
      ...(data.minute !== undefined ? { minute: Math.min(59, Math.max(0, Math.trunc(data.minute))) } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
}

export async function deleteRecurringReminder(userId: string, id: string): Promise<void> {
  await prisma.recurringReminder.deleteMany({ where: { id, userId } });
}

/**
 * Dispara los recordatorios recurrentes que corresponden a AHORA (hora ARG).
 * Pensado para correr cada minuto desde /api/cron/reminders. Idempotente por día
 * vía lastFiredOn, así que si el cron corre dos veces el mismo minuto no duplica.
 */
export async function fireDueRecurringReminders(): Promise<{ fired: number }> {
  const { weekday, hour, minute } = nowArgParts();
  const today = todayArgDate();

  const due = await prisma.recurringReminder.findMany({
    where: {
      isActive: true,
      hour,
      minute,
      daysOfWeek: { has: weekday },
      OR: [{ lastFiredOn: null }, { lastFiredOn: { lt: today } }],
    },
    include: { user: { select: { whatsappNumber: true } } },
  });

  let fired = 0;
  for (const r of due) {
    const text = decrypt(r.text) ?? r.text;
    const link = r.link ? decrypt(r.link) ?? r.link : null;
    const isUrl = !!link && /^https?:\/\//i.test(link);

    // Marcamos disparado ANTES de entregar para no arriesgar duplicados si el
    // cron se solapa. Si la entrega falla, se reintenta recién al día siguiente.
    await prisma.recurringReminder
      .update({ where: { id: r.id }, data: { lastFiredOn: today } })
      .catch(() => {});

    let delivered = false;
    if (r.user.whatsappNumber) {
      try {
        // El link va en su propia línea para que WhatsApp lo haga tocable.
        await sendText(r.user.whatsappNumber, `⏰ *Recordatorio:* ${text}` + (link ? `\n\n${link}` : ""));
        delivered = true;
      } catch {
        // fuera de la ventana de 24h de Meta → cae a push
      }
    }
    if (!delivered) {
      await sendPushToUser(r.userId, {
        title: "⏰ Recordatorio",
        body: text,
        url: isUrl ? link : "/dashboard",
      }).catch(() => {});
    }
    fired++;
  }

  return { fired };
}
