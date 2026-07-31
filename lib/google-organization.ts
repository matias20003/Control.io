import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { getAccessToken } from "@/lib/google";

const API = "https://www.googleapis.com/calendar/v3";
const siteBase = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://controlio.site").replace(/\/+$/, "");

async function google(userId: string, path: string, init?: RequestInit) {
  const token = await getAccessToken(userId);
  if (!token) throw new Error("Conectá Google Calendar nuevamente");
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error(`Google Calendar ${response.status}: ${(await response.text()).slice(0, 180)}`);
  return response.status === 204 ? null : response.json();
}

export async function ensureControlCalendar(userId: string): Promise<string> {
  const saved = await prisma.googleCalendarSync.findUnique({ where: { userId } });
  if (saved?.calendarId) return saved.calendarId;
  try {
    const created = await google(userId, "/calendars", {
      method: "POST",
      body: JSON.stringify({ summary: "Control.io", description: "Tareas y hábitos programados desde Control.io", timeZone: "America/Argentina/Buenos_Aires" }),
    }) as { id: string };
    await prisma.googleCalendarSync.upsert({
      where: { userId }, create: { userId, calendarId: created.id }, update: { calendarId: created.id },
    });
    return created.id;
  } catch {
    // Las conexiones anteriores sólo tenían calendar.events. Funcionan con el
    // calendario primario hasta que el usuario reconecta y concede el scope nuevo.
    await prisma.googleCalendarSync.upsert({
      where: { userId }, create: { userId, calendarId: "primary" }, update: { calendarId: "primary" },
    });
    return "primary";
  }
}

export async function syncTaskToGoogle(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task?.scheduledStart) return;
  const calendarId = task.googleCalendarId ?? await ensureControlCalendar(userId);
  const title = decrypt(task.title) ?? task.title;
  const description = task.description ? (decrypt(task.description) ?? task.description) : undefined;
  const body = {
    summary: title,
    description,
    start: { dateTime: task.scheduledStart.toISOString(), timeZone: "America/Argentina/Buenos_Aires" },
    end: { dateTime: (task.scheduledEnd ?? new Date(task.scheduledStart.getTime() + 3_600_000)).toISOString(), timeZone: "America/Argentina/Buenos_Aires" },
    reminders: task.reminderMinutes == null ? { useDefault: true } : {
      useDefault: false, overrides: [{ method: "popup", minutes: task.reminderMinutes }],
    },
    extendedProperties: { private: { controlIoTaskId: task.id, controlIoUserId: userId } },
  };
  try {
    const path = task.googleEventId
      ? `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(task.googleEventId)}`
      : `/calendars/${encodeURIComponent(calendarId)}/events`;
    const event = await google(userId, path, { method: task.googleEventId ? "PATCH" : "POST", body: JSON.stringify(body) }) as {
      id: string; etag?: string; updated?: string;
    };
    await prisma.task.update({
      where: { id: task.id },
      data: {
        googleEventId: event.id,
        googleCalendarId: calendarId,
        googleEtag: event.etag,
        googleUpdatedAt: event.updated ? new Date(event.updated) : new Date(),
        syncStatus: "SYNCED",
        syncError: null,
      },
    });
  } catch (error) {
    await prisma.task.update({
      where: { id: task.id },
      data: { syncStatus: "ERROR", syncError: error instanceof Error ? error.message : "Error de sincronización" },
    });
    throw error;
  }
}

type GoogleEvent = {
  id: string; etag?: string; status?: string; summary?: string; description?: string; updated?: string;
  start?: { dateTime?: string }; end?: { dateTime?: string };
  extendedProperties?: { private?: { controlIoTaskId?: string } };
};

export async function syncGoogleOrganization(userId: string) {
  const calendarId = await ensureControlCalendar(userId);
  const state = await prisma.googleCalendarSync.findUnique({ where: { userId } });
  const params = new URLSearchParams({ singleEvents: "true", maxResults: "2500", showDeleted: "true" });
  if (state?.syncToken) params.set("syncToken", state.syncToken);
  else params.set("timeMin", new Date(Date.now() - 90 * 86_400_000).toISOString());
  let data: { items?: GoogleEvent[]; nextSyncToken?: string };
  try {
    data = await google(userId, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`) as typeof data;
  } catch (error) {
    if (state?.syncToken && error instanceof Error && error.message.includes("410")) {
      await prisma.googleCalendarSync.update({ where: { userId }, data: { syncToken: null } });
      return syncGoogleOrganization(userId);
    }
    throw error;
  }
  for (const event of data.items ?? []) {
    const taskId = event.extendedProperties?.private?.controlIoTaskId;
    if (!taskId) continue;
    const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
    if (!task) continue;
    if (event.status === "cancelled") {
      await prisma.task.update({ where: { id: task.id }, data: { scheduledStart: null, scheduledEnd: null, syncStatus: "LOCAL" } });
      continue;
    }
    const googleUpdated = event.updated ? new Date(event.updated) : new Date(0);
    if (task.updatedAt > googleUpdated) {
      await syncTaskToGoogle(userId, task.id);
      continue;
    }
    await prisma.task.update({
      where: { id: task.id },
      data: {
        ...(event.summary ? { title: event.summary } : {}),
        description: event.description ?? task.description,
        scheduledStart: event.start?.dateTime ? new Date(event.start.dateTime) : task.scheduledStart,
        scheduledEnd: event.end?.dateTime ? new Date(event.end.dateTime) : task.scheduledEnd,
        googleEtag: event.etag,
        googleUpdatedAt: googleUpdated,
        syncStatus: "SYNCED",
        syncError: null,
      },
    });
  }
  await prisma.googleCalendarSync.upsert({
    where: { userId },
    create: { userId, calendarId, syncToken: data.nextSyncToken, lastSyncedAt: new Date() },
    update: { syncToken: data.nextSyncToken, lastSyncedAt: new Date(), lastError: null },
  });
  return { count: data.items?.length ?? 0 };
}

export async function ensureCalendarWatch(userId: string) {
  const calendarId = await ensureControlCalendar(userId);
  const current = await prisma.googleCalendarSync.findUnique({ where: { userId } });
  if (current?.channelExpiresAt && current.channelExpiresAt > new Date(Date.now() + 86_400_000)) return;
  const channelId = randomUUID();
  const channelToken = randomUUID();
  const expiration = Date.now() + 6 * 86_400_000;
  const result = await google(userId, `/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
    method: "POST",
    body: JSON.stringify({
      id: channelId,
      type: "web_hook",
      address: `${siteBase()}/api/google/calendar/webhook`,
      token: channelToken,
      expiration: String(expiration),
    }),
  }) as { resourceId?: string; expiration?: string };
  await prisma.googleCalendarSync.update({
    where: { userId },
    data: {
      channelId, channelToken, resourceId: result.resourceId,
      channelExpiresAt: new Date(Number(result.expiration ?? expiration)),
    },
  });
}
