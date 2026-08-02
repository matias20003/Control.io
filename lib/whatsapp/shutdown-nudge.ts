import "server-only";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { sendText } from "@/lib/whatsapp/kapso";
import { ARG_TZ } from "@/lib/timezone";
import { planForDay, type DayTask } from "@/lib/organization-day";

/**
 * Empujón nocturno para cerrar el día.
 *
 * El ritual de cierre es lo que garantiza que nada quede huérfano, pero
 * obligarlo es lo que hace que la gente abandone este tipo de apps. Así que se
 * avisa una vez y se puede ignorar.
 *
 * DOS REGLAS QUE NO SE PUEDEN ROMPER, porque romperlas ya causó un incidente
 * (un mensaje por minuto durante una hora, a todos los que tenían WhatsApp):
 *
 *  1. El cron que llama a esto corre CADA MINUTO. Mirar sólo la hora no alcanza:
 *     hay que marcar el envío del día ANTES de llamar a WhatsApp, con un UPDATE
 *     condicional que sirve de claim atómico.
 *  2. Es opt-in. Nadie recibe un mensaje que no pidió: shutdown_enabled arranca
 *     en FALSE y sólo lo prende el usuario.
 */

/** Día calendario argentino, "YYYY-MM-DD". */
function todayArg(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: ARG_TZ });
}

/**
 * Hora de Argentina, 0-23.
 *
 * Se calcula con la zona explícita, así que no depende de en qué zona corra el
 * server (Vercel es UTC) y no se adelanta ni se atrasa. Se usa hourCycle "h23"
 * a propósito: con hour12:false hay builds de ICU donde la medianoche sale
 * como "24" y el aviso caería en un horario que no existe.
 */
function hourArg(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: ARG_TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date()),
  );
}

export async function fireShutdownNudges(): Promise<{ sent: number; attempted: number }> {
  const day = todayArg();
  const hour = hourArg();

  // Sólo quien lo prendió, a su hora, y sólo si hoy todavía no se le mandó.
  const recipients = await prisma.$queryRaw<{ user_id: string; whatsapp_number: string | null }[]>`
    SELECT s.user_id, p."whatsappNumber" whatsapp_number
    FROM whatsapp_organizer_settings s
    JOIN profiles p ON p.id = s.user_id
    WHERE s.shutdown_enabled = TRUE
      AND s.shutdown_hour = ${hour}
      AND coalesce(s.last_shutdown_date, '') <> ${day}`;

  let sent = 0;
  let attempted = 0;

  for (const recipient of recipients) {
    // Claim atómico ANTES de cualquier llamada externa: si otra corrida del
    // cron ya lo tomó, este UPDATE afecta 0 filas y salimos sin mandar nada.
    const claimed = await prisma.$executeRaw`
      UPDATE whatsapp_organizer_settings
      SET last_shutdown_date = ${day}, updated_at = NOW()
      WHERE user_id = ${recipient.user_id} AND coalesce(last_shutdown_date, '') <> ${day}`;
    if (!claimed) continue;

    if (!recipient.whatsapp_number) continue;
    attempted++;

    const rows = await prisma.task.findMany({
      where: { userId: recipient.user_id, done: false, someday: false },
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

    const plan = planForDay(tasks, day, day);
    const pending = [...plan.overdue, ...plan.timed, ...plan.untimed, ...plan.due];
    // El claim ya quedó tomado, así que aunque no haya nada que avisar tampoco
    // se reintenta en el próximo minuto. Eso es lo que queremos.
    if (pending.length === 0) continue;

    const lista = pending.slice(0, 4).map((task) => `• ${task.title}`).join("\n");
    const resto = pending.length > 4 ? `\n…y ${pending.length - 4} más` : "";
    const atrasadas = plan.overdue.length > 0 ? ` (${plan.overdue.length} vienen de antes)` : "";

    try {
      await sendText(
        recipient.whatsapp_number,
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
