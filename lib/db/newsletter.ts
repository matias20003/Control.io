import { prisma } from "@/lib/prisma";
import { startOfTodayArg, startOfDayArg } from "@/lib/timezone";
import type { AnalyzedArticle } from "@/lib/services/newsletter-ai";

export type SerializedConfig = {
  topics: string[];
  priorityTopics: string[];
  language: string;
  country: string;
  isActive: boolean;
  sendHour: number;
  notifyOnReady: boolean;
  notifyPush: boolean;
  notifyWhatsapp: boolean;
};

export type SerializedEdition = {
  id: string;
  date: string; // ISO
  summary: string;
  articles: AnalyzedArticle[];
  isRead: boolean;
  createdAt: string;
};

const DEFAULT_CONFIG: SerializedConfig = {
  topics: [],
  priorityTopics: [],
  language: "es",
  country: "ar",
  isActive: true,
  sendHour: 8,
  notifyOnReady: true,
  notifyPush: true,
  notifyWhatsapp: true,
};

export async function getConfig(userId: string): Promise<SerializedConfig> {
  const row = await prisma.newsletterConfig.findUnique({ where: { userId } });
  if (!row) return DEFAULT_CONFIG;
  return {
    topics: row.topics,
    priorityTopics: row.priorityTopics,
    language: row.language,
    country: row.country,
    isActive: row.isActive,
    sendHour: row.sendHour,
    notifyOnReady: row.notifyOnReady,
    notifyPush: row.notifyPush,
    notifyWhatsapp: row.notifyWhatsapp,
  };
}

export async function upsertConfig(
  userId: string,
  data: Partial<SerializedConfig>
): Promise<SerializedConfig> {
  const topics = (data.topics ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 12);

  // priorityTopics siempre se acota a los que existen en topics (no puede ser
  // prioritario un tema que no está en la lista).
  const priorityTopics = (data.priorityTopics ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && topics.includes(t));

  const sendHour =
    data.sendHour == null
      ? undefined
      : Math.min(23, Math.max(0, Math.trunc(data.sendHour)));

  const row = await prisma.newsletterConfig.upsert({
    where: { userId },
    create: {
      userId,
      topics,
      priorityTopics,
      language: data.language ?? "es",
      country: data.country ?? "ar",
      isActive: data.isActive ?? true,
      sendHour: sendHour ?? 8,
      notifyOnReady: data.notifyOnReady ?? true,
      notifyPush: data.notifyPush ?? true,
      notifyWhatsapp: data.notifyWhatsapp ?? true,
    },
    update: {
      ...(data.topics !== undefined ? { topics } : {}),
      ...(data.priorityTopics !== undefined || data.topics !== undefined
        ? { priorityTopics }
        : {}),
      ...(data.language !== undefined ? { language: data.language } : {}),
      ...(data.country !== undefined ? { country: data.country } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(sendHour !== undefined ? { sendHour } : {}),
      ...(data.notifyOnReady !== undefined
        ? { notifyOnReady: data.notifyOnReady }
        : {}),
      ...(data.notifyPush !== undefined ? { notifyPush: data.notifyPush } : {}),
      ...(data.notifyWhatsapp !== undefined ? { notifyWhatsapp: data.notifyWhatsapp } : {}),
    },
  });

  return {
    topics: row.topics,
    priorityTopics: row.priorityTopics,
    language: row.language,
    country: row.country,
    isActive: row.isActive,
    sendHour: row.sendHour,
    notifyOnReady: row.notifyOnReady,
    notifyPush: row.notifyPush,
    notifyWhatsapp: row.notifyWhatsapp,
  };
}

function serializeEdition(row: {
  id: string;
  date: Date | string;
  summary: string;
  articles: unknown;
  isRead: boolean;
  createdAt: Date | string;
}): SerializedEdition {
  return {
    id: row.id,
    date: row.date instanceof Date ? row.date.toISOString() : row.date,
    summary: row.summary,
    articles: (row.articles as AnalyzedArticle[]) ?? [],
    isRead: row.isRead,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

export async function getEditions(
  userId: string,
  limit = 30
): Promise<SerializedEdition[]> {
  const rows = await prisma.newsletterEdition.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: limit,
  });
  return rows.map(serializeEdition);
}

export async function getLatestEdition(
  userId: string
): Promise<SerializedEdition | null> {
  const row = await prisma.newsletterEdition.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  });
  return row ? serializeEdition(row) : null;
}

/** Crea/actualiza la edición del día (idempotente por usuario+día). */
export async function saveEdition(
  userId: string,
  summary: string,
  articles: AnalyzedArticle[],
  when?: Date
): Promise<SerializedEdition> {
  const date = when ? startOfDayArg(when) : startOfTodayArg();
  const row = await prisma.newsletterEdition.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, summary, articles: articles as object[] },
    update: { summary, articles: articles as object[], isRead: false },
  });
  return serializeEdition(row);
}

export async function markEditionRead(
  userId: string,
  editionId: string
): Promise<void> {
  await prisma.newsletterEdition.updateMany({
    where: { id: editionId, userId },
    data: { isRead: true },
  });
}

/** ¿Hay una edición de HOY sin leer? Alimenta el badge in-app y el banner. */
export async function hasUnreadTodayEdition(userId: string): Promise<boolean> {
  const today = startOfTodayArg();
  const row = await prisma.newsletterEdition.findFirst({
    where: { userId, date: today, isRead: false },
    select: { id: true },
  });
  return row != null;
}

/** ¿Ya existe la edición de HOY? Sirve para no volver a avisar si se regenera. */
export async function todayEditionExists(userId: string): Promise<boolean> {
  const today = startOfTodayArg();
  const row = await prisma.newsletterEdition.findUnique({
    where: { userId_date: { userId, date: today } },
    select: { id: true },
  });
  return row != null;
}

export type ActiveConfig = {
  userId: string;
  topics: string[];
  priorityTopics: string[];
  language: string;
  country: string;
  sendHour: number;
  notifyOnReady: boolean;
  notifyPush: boolean;
  notifyWhatsapp: boolean;
  whatsappNumber: string | null;
};

/** Configs activas con al menos un tema — base para los crones. */
export async function getActiveConfigs(): Promise<ActiveConfig[]> {
  const rows = await prisma.newsletterConfig.findMany({
    where: { isActive: true },
    select: {
      userId: true,
      topics: true,
      priorityTopics: true,
      language: true,
      country: true,
      sendHour: true,
      notifyOnReady: true,
      notifyPush: true,
      notifyWhatsapp: true,
      user: { select: { whatsappNumber: true } },
    },
  });
  return rows
    .filter((r) => r.topics.length > 0)
    .map((r) => ({
      userId: r.userId,
      topics: r.topics,
      priorityTopics: r.priorityTopics,
      language: r.language,
      country: r.country,
      sendHour: r.sendHour,
      notifyOnReady: r.notifyOnReady,
      notifyPush: r.notifyPush,
      notifyWhatsapp: r.notifyWhatsapp,
      whatsappNumber: r.user?.whatsappNumber ?? null,
    }));
}

/** Configs activas cuyo horario de envío coincide con `hour` (0–23, ARG). */
export async function getConfigsForHour(hour: number): Promise<ActiveConfig[]> {
  const all = await getActiveConfigs();
  return all.filter((c) => c.sendHour === hour);
}
