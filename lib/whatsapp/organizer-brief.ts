import "server-only";
import { prisma } from "@/lib/prisma";
import { listCalendarEvents, listGoogleTasks } from "@/lib/google";
import { getTasks } from "@/lib/db/tasks";
import { sendText } from "@/lib/whatsapp/kapso";
import { sendPushToUser } from "@/lib/push/send";
import { formatOrganizerReply, type OrganizerQuery } from "@/lib/whatsapp/organizer";
import { ARG_TZ } from "@/lib/timezone";
import { fromZonedTime } from "date-fns-tz";

function todayArg(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: ARG_TZ });
}

export async function fireOrganizerBriefs(): Promise<{ sent: number; attempted: number }> {
  const now = new Date();
  const hour = Number(now.toLocaleTimeString("en-US", {
    timeZone: ARG_TZ, hour: "2-digit", hour12: false,
  }).slice(0, 2)) % 24;
  const day = todayArg();
  const recipients = await prisma.$queryRaw<{ user_id: string; whatsapp_number: string | null }[]>`
    SELECT s.user_id, p."whatsappNumber" whatsapp_number
    FROM whatsapp_organizer_settings s
    JOIN profiles p ON p.id = s.user_id
    WHERE s.brief_enabled = TRUE
      AND s.brief_hour = ${hour}
      AND coalesce(s.last_brief_date, '') <> ${day}`;
  let sent = 0;
  for (const recipient of recipients) {
    // Claim idempotente antes de hacer llamadas externas.
    const claimed = await prisma.$executeRaw`
      UPDATE whatsapp_organizer_settings SET last_brief_date = ${day}, updated_at = NOW()
      WHERE user_id = ${recipient.user_id} AND coalesce(last_brief_date, '') <> ${day}`;
    if (!claimed) continue;
    const from = fromZonedTime(`${day}T00:00`, ARG_TZ);
    const to = fromZonedTime(`${day}T23:59`, ARG_TZ);
    const query: OrganizerQuery = { kind: "agenda", from, to, hasSpecificTime: false, label: "hoy" };
    const [events, localTasks, googleTasks] = await Promise.all([
      listCalendarEvents(recipient.user_id, { from, to }).catch(() => []),
      getTasks(recipient.user_id).catch(() => []),
      listGoogleTasks(recipient.user_id).catch(() => []),
    ]);
    const pending = [
      ...localTasks.filter((task) => !task.done).slice(0, 3).map((task) => task.title),
      ...googleTasks.slice(0, 3).map((task) => task.title),
    ].filter((title, index, all) => all.indexOf(title) === index).slice(0, 3);
    const agenda = formatOrganizerReply(query, events);
    const tasks = pending.length
      ? `\n\n🎯 *Tus prioridades:*\n${pending.map((title) => `• ${title}`).join("\n")}`
      : "\n\n✅ No tenés tareas pendientes prioritarias.";
    const message = `☀️ *Buen día — resumen de hoy*\n\n${agenda}${tasks}`;
    let delivered = false;
    if (recipient.whatsapp_number) {
      delivered = await sendText(recipient.whatsapp_number, message).then(() => true).catch(() => false);
    }
    if (!delivered) {
      delivered = (await sendPushToUser(recipient.user_id, {
        title: "☀️ Tu organización de hoy",
        body: events.length ? `Tenés ${events.length} evento(s) en el calendario.` : "Tu agenda de hoy está libre.",
        url: "/calendario",
      }).catch(() => 0)) > 0;
    }
    if (delivered) sent++;
  }
  return { sent, attempted: recipients.length };
}
