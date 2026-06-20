import { encrypt, decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

// Scopes: crear/editar eventos del calendario + tareas + email para saber qué cuenta.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks",
  "openid",
  "email",
];

function siteBase(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL;
  return u && u.startsWith("https://") ? u.replace(/\/+$/, "") : "https://controlio.site";
}

export function googleRedirectUri(): string {
  return `${siteBase()}/api/google/callback`;
}

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // para recibir refresh_token
    prompt: "consent", // fuerza el refresh_token aunque ya haya consentido antes
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

/** Cambia el code de OAuth por tokens. Devuelve el refresh_token (para guardar) y el email. */
export async function exchangeCode(
  code: string
): Promise<{ refreshToken: string | null; email: string | null }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange falló: ${res.status} ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as { refresh_token?: string; id_token?: string };

  let email: string | null = null;
  if (data.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64").toString());
      email = payload.email ?? null;
    } catch {}
  }
  return { refreshToken: data.refresh_token ?? null, email };
}

export async function saveGoogleConnection(userId: string, refreshToken: string, email: string | null): Promise<void> {
  await prisma.profile.update({
    where: { id: userId },
    data: { googleRefreshToken: encrypt(refreshToken), googleEmail: email, googleConnectedAt: new Date() },
  });
}

export async function disconnectGoogle(userId: string): Promise<void> {
  await prisma.profile.update({
    where: { id: userId },
    data: { googleRefreshToken: null, googleEmail: null, googleConnectedAt: null },
  });
}

export async function getGoogleStatus(userId: string): Promise<{ connected: boolean; email: string | null }> {
  const p = await prisma.profile.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true, googleEmail: true },
  });
  return { connected: !!p?.googleRefreshToken, email: p?.googleEmail ?? null };
}

/** Saca un access token fresco a partir del refresh token guardado. */
async function getAccessToken(userId: string): Promise<string | null> {
  const p = await prisma.profile.findUnique({ where: { id: userId }, select: { googleRefreshToken: true } });
  const refresh = decrypt(p?.googleRefreshToken ?? null);
  if (!refresh) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("[google] refresh falló:", res.status, await res.text().catch(() => ""));
    return null;
  }
  return ((await res.json()) as { access_token?: string }).access_token ?? null;
}

/** Crea un evento en el calendario primario. Devuelve true si se creó. */
export async function createCalendarEvent(
  userId: string,
  ev: { summary: string; start: Date; end?: Date }
): Promise<boolean> {
  const token = await getAccessToken(userId);
  if (!token) return false;
  const end = ev.end ?? new Date(ev.start.getTime() + 60 * 60_000); // 1h por defecto
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: ev.summary,
      start: { dateTime: ev.start.toISOString() },
      end: { dateTime: end.toISOString() },
    }),
  });
  if (!res.ok) console.error("[google] crear evento falló:", res.status, await res.text().catch(() => ""));
  return res.ok;
}

/** Crea una tarea en Google Tasks (lista por defecto). */
export async function createGoogleTask(
  userId: string,
  t: { title: string; due?: Date | null }
): Promise<boolean> {
  const token = await getAccessToken(userId);
  if (!token) return false;
  const res = await fetch("https://tasks.googleapis.com/tasks/v1/lists/@default/tasks", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: t.title, ...(t.due ? { due: t.due.toISOString() } : {}) }),
  });
  if (!res.ok) console.error("[google] crear task falló:", res.status, await res.text().catch(() => ""));
  return res.ok;
}
