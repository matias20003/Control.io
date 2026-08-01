import "server-only";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { sendText } from "@/lib/whatsapp/kapso";
import { nowArgParts, startOfTodayArg } from "@/lib/timezone";
import { planForDay, argDay, type DayTask } from "@/lib/organization-day";

/**
 * Empujón nocturno para cerrar el día.
 *
 * El ritual de cierre es lo que garantiza que nada quede huérfano, pero
 * obligarlo es lo que hace que la gente abandone este tipo de apps. Así que se
 * avisa y se puede ignorar: el mensaje llega una vez por noche y la sección
 * funciona igual si nunca se abre.
 */

/** Hora ARG a la que se manda el aviso. */
const NUDGE_HOUR = 21;

export async function fireShutdownNudges(): Promise<{ sent: number; attempted: number }> {
  const { hour } = nowArgParts();
  if (hour !== NUDGE_HOUR) return { sent: 0, attempted: 0 };

  const today = argDay(startOfTodayArg());

  const profiles = await prisma.profile.findMany({
    where: { whatsappNumber: { not: null } },
    select: { id: true, whatsappNumber: true },
  });

  let sent = 0;
  let attempted = 0;

  for (const profile of profiles) {
    if (!profile.whatsappNumber) continue;

    // Sólo lo que sigue abierto. Traemos poco y filtramos con la misma lógica
    // que usa la vista Hoy, para que el número del mensaje sea el que ve en la app.
    const rows = await prisma.task.findMany({
      where: { userId: profile.id, done: false, someday: false },
      select: {
        id: true, title: true, dueDate: true, scheduledStart: true, scheduledEnd: true,
        someday: true, done: true, priority: true, urgent: true, important: true, order: true,
      },
      take: 300,
    });

    const tasks: (DayTask & { title: string })[] = rows.map((row) => ({
      id: row.id,
      title: decrypt(row.title) ?? row.title,
      dueDate: row.dueDate?.toISOString() ?? null,
      scheduledStart: row.scheduledStart?.toISOString() ?? null,
      scheduledEnd: row.scheduledEnd?.toISOString() ?? null,
      someday: row.someday,
      done: row.done,
      priority: row.priority,
      urgent: row.urgent,
      important: row.important,
      order: row.order,
    }));

    const plan = planForDay(tasks, today, today);
    const pending = [...plan.overdue, ...plan.timed, ...plan.untimed, ...plan.due];
    if (pending.length === 0) continue;

    attempted++;
    const lista = pending.slice(0, 4).map((task) => `• ${task.title}`).join("\n");
    const resto = pending.length > 4 ? `\n…y ${pending.length - 4} más` : "";
    const atrasadas = plan.overdue.length > 0 ? ` (${plan.overdue.length} vienen de antes)` : "";

    try {
      await sendText(
        profile.whatsappNumber,
        `🌙 *Cerrar el día*\n\nQuedaron ${pending.length} sin terminar${atrasadas}:\n${lista}${resto}\n\n` +
        `Decime qué hago con ellas y las acomodo, o entrá a Organización y cerralas de a una.`,
      );
      sent++;
    } catch {
      // Fuera de la ventana de 24h de Meta o error de red: no se reintenta.
      // Es un empujón, no un recordatorio crítico.
    }
  }

  return { sent, attempted };
}
