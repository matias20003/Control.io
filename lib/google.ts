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

/** Access token: usa el cacheado si sigue vigente; si no, lo refresca y lo guarda. */
async function getAccessToken(userId: string): Promise<string | null> {
  const p = await prisma.profile.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true, googleAccessToken: true, googleTokenExpiry: true },
  });
  const refresh = decrypt(p?.googleRefreshToken ?? null);
  if (!refresh) return null;

  // Cache válido (con 60s de margen) → lo reutilizamos.
  const cached = decrypt(p?.googleAccessToken ?? null);
  if (cached && p?.googleTokenExpiry && p.googleTokenExpiry.getTime() > Date.now() + 60_000) {
    return cached;
  }

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
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (data.access_token) {
    await prisma.profile
      .update({
        where: { id: userId },
        data: {
          googleAccessToken: encrypt(data.access_token),
          googleTokenExpiry: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
        },
      })
      .catch(() => {});
  }
  return data.access_token ?? null;
}

/** Próximos eventos del calendario (para "¿qué tengo el lunes?"). */
export async function listCalendarEvents(
  userId: string,
  opts: { daysAhead?: number; from?: Date; to?: Date } = {}
): Promise<{ id: string; summary: string; start: string }[]> {
  const token = await getAccessToken(userId);
  if (!token) return [];
  const now = opts.from ?? new Date();
  const max = opts.to ?? new Date(now.getTime() + (opts.daysAhead ?? 7) * 86_400_000);
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    `timeMin=${encodeURIComponent(now.toISOString())}&timeMax=${encodeURIComponent(max.toISOString())}` +
    `&singleEvents=true&orderBy=startTime&maxResults=250`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: { id?: string; summary?: string; start?: { dateTime?: string; date?: string } }[] };
  return (data.items ?? [])
    .filter((e) => e.id)
    .map((e) => ({
      id: e.id!,
      summary: e.summary ?? "(sin título)",
      start: e.start?.dateTime ?? e.start?.date ?? "",
    }));
}

/** Borra un evento del calendario primario. */
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<GoogleResult> {
  const token = await getAccessToken(userId);
  if (!token) return { ok: false, error: "no pude renovar el acceso a Google" };
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Google ${res.status}: ${body.slice(0, 180)}` };
  }
  return { ok: true };
}

/** Edita un evento (cambia título y/o reprograma start/end). */
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  patch: { summary?: string; start?: Date; end?: Date }
): Promise<GoogleResult> {
  const token = await getAccessToken(userId);
  if (!token) return { ok: false, error: "no pude renovar el acceso a Google" };
  const body: Record<string, unknown> = {};
  if (patch.summary) body.summary = patch.summary;
  if (patch.start) body.start = { dateTime: patch.start.toISOString() };
  if (patch.end) body.end = { dateTime: patch.end.toISOString() };
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const bodyTxt = await res.text().catch(() => "");
    return { ok: false, error: `Google ${res.status}: ${bodyTxt.slice(0, 180)}` };
  }
  return { ok: true };
}

/** Tareas pendientes de Google Tasks. */
export async function listGoogleTasks(userId: string): Promise<{ id: string; title: string; due: string | null }[]> {
  const token = await getAccessToken(userId);
  if (!token) return [];
  const res = await fetch(
    "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false&maxResults=30",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: { id?: string; title?: string; due?: string }[] };
  return (data.items ?? [])
    .filter((t) => t.id && t.title)
    .map((t) => ({ id: t.id!, title: t.title ?? "", due: t.due ?? null }));
}

/** Marca una tarea de Google Tasks como completada. */
export async function completeGoogleTask(userId: string, taskId: string): Promise<GoogleResult> {
  const token = await getAccessToken(userId);
  if (!token) return { ok: false, error: "no pude renovar el acceso a Google" };
  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Google ${res.status}: ${body.slice(0, 180)}` };
  }
  return { ok: true };
}

export type GoogleResult = { ok: boolean; error?: string };

/** Crea un evento en el calendario primario. */
export async function createCalendarEvent(
  userId: string,
  ev: { summary: string; start: Date; end?: Date }
): Promise<GoogleResult> {
  const token = await getAccessToken(userId);
  if (!token) return { ok: false, error: "no pude renovar el acceso (revisá GOOGLE_CLIENT_SECRET o reconectá Google)" };
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
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[google] crear evento falló:", res.status, body);
    return { ok: false, error: `Google ${res.status}: ${body.slice(0, 180)}` };
  }
  return { ok: true };
}

/** Crea una tarea en Google Tasks (lista por defecto). */
export async function createGoogleTask(
  userId: string,
  t: { title: string; due?: Date | null }
): Promise<GoogleResult> {
  const token = await getAccessToken(userId);
  if (!token) return { ok: false, error: "no pude renovar el acceso a Google" };
  const res = await fetch("https://tasks.googleapis.com/tasks/v1/lists/@default/tasks", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: t.title, ...(t.due ? { due: t.due.toISOString() } : {}) }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[google] crear task falló:", res.status, body);
    return { ok: false, error: `Google ${res.status}: ${body.slice(0, 180)}` };
  }
  return { ok: true };
}
