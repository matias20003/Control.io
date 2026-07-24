import "server-only";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push/send";
import { sendText } from "@/lib/whatsapp/kapso";

// Alertas para el ADMIN (dueño). Usa app_flags(key,value) para throttle y contadores.

async function flagGet(key: string): Promise<string | null> {
  const rows = (await prisma.$queryRaw`SELECT value FROM app_flags WHERE key = ${key}`) as { value: string | null }[];
  return rows[0]?.value ?? null;
}
async function flagSet(key: string, value: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO app_flags (key, value, updated_at) VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = now()`;
}

/** Suma 1 a un contador diario (clave prefijo:YYYY-MM-DD) y devuelve el total. */
export async function bumpDailyCounter(prefix: string, day: string): Promise<number> {
  const key = `${prefix}:${day}`;
  const rows = (await prisma.$queryRaw`
    INSERT INTO app_flags (key, value, updated_at) VALUES (${key}, '1', now())
    ON CONFLICT (key) DO UPDATE SET value = (COALESCE(app_flags.value, '0')::int + 1)::text, updated_at = now()
    RETURNING value`) as { value: string }[];
  return Number(rows[0]?.value ?? "1");
}

/** Avisa al dueño por push + WhatsApp (sin throttle). Para eventos importantes. */
export async function notifyAdmin(title: string, body: string): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  const owner = await prisma.profile.findFirst({ where: { email: adminEmail }, select: { id: true, whatsappNumber: true } });
  if (!owner) return;
  await sendPushToUser(owner.id, { title, body, url: "/admin" }).catch(() => {});
  if (owner.whatsappNumber) await sendText(owner.whatsappNumber, `${title}\n${body}`).catch(() => {});
}

/**
 * Un usuario pidió soporte que el bot no pudo resolver: avisa al dueño con quién
 * fue y el problema. Throttle corto por usuario (2 min) para no duplicar.
 */
export async function notifySupportRequest(fromUserId: string, motivo: string): Promise<void> {
  const key = `support_last:${fromUserId}`;
  const last = Number((await flagGet(key)) ?? "0");
  if (Date.now() - last < 2 * 60_000) return;
  await flagSet(key, String(Date.now()));

  const prof = await prisma.profile.findFirst({ where: { id: fromUserId }, select: { name: true, whatsappNumber: true, email: true } });
  const who = prof?.name || prof?.whatsappNumber || prof?.email || fromUserId.slice(0, 8);
  await notifyAdmin("🆘 Soporte — un usuario necesita ayuda", `${who}: ${motivo.slice(0, 400)}`);
}

/**
 * Manda una alerta al dueño por push + WhatsApp, pero NO más de una vez cada
 * `minMinutes` (para no spamear). Devuelve true si la envió.
 */
export async function notifyAdminThrottled(throttleKey: string, minMinutes: number, title: string, body: string): Promise<boolean> {
  const last = Number((await flagGet(throttleKey)) ?? "0");
  const now = Date.now();
  if (now - last < minMinutes * 60_000) return false;
  await flagSet(throttleKey, String(now));

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const owner = await prisma.profile.findFirst({ where: { email: adminEmail }, select: { id: true, whatsappNumber: true } });
  if (!owner) return false;

  await sendPushToUser(owner.id, { title, body, url: "/admin" }).catch(() => {});
  if (owner.whatsappNumber) await sendText(owner.whatsappNumber, `⚠️ ${title}\n${body}`).catch(() => {});
  return true;
}
