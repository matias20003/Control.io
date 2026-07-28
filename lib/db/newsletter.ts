import { prisma } from "@/lib/prisma";
import {
  startOfTodayArg,
  startOfDayArg,
  todayStringArg,
} from "@/lib/timezone";
import type { AnalyzedArticle } from "@/lib/services/newsletter-ai";
import {
  type BriefLength,
  type DiscoveryLevel,
  type SerializedBriefItem,
} from "@/lib/brief/types";
import { serializeBriefItem } from "@/lib/db/brief";

export type SerializedConfig = {
  topics: string[];
  priorityTopics: string[];
  language: string;
  country: string;
  isActive: boolean;
  sendHour: number;
  sendHours: number[];
  notifyOnReady: boolean;
  notifyPush: boolean;
  notifyWhatsapp: boolean;
  discoveryLevel: DiscoveryLevel;
  briefLength: BriefLength;
  localSourcesMigrated: boolean;
};

export type SerializedEdition = {
  id: string;
  date: string; // ISO
  summary: string;
  articles: AnalyzedArticle[];
  isRead: boolean;
  completedAt: string | null;
  reviewedCount: number;
  createdAt: string;
  updatedAt: string;
  items: SerializedBriefItem[];
};

const DEFAULT_CONFIG: SerializedConfig = {
  topics: [],
  priorityTopics: [],
  language: "es",
  country: "ar",
  isActive: true,
  sendHour: 8,
  sendHours: [8],
  notifyOnReady: true,
  notifyPush: true,
  notifyWhatsapp: true,
  discoveryLevel: "BALANCED",
  briefLength: "NORMAL",
  localSourcesMigrated: false,
};

function normalizeSendHours(
  primary: number,
  second?: number | null,
  third?: number | null
): number[] {
  return Array.from(
    new Set(
      [primary, second, third].filter(
        (hour): hour is number =>
          typeof hour === "number" &&
          Number.isInteger(hour) &&
          hour >= 0 &&
          hour <= 23
      )
    )
  )
    .sort((a, b) => a - b)
    .slice(0, 3);
}

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
    sendHours: normalizeSendHours(row.sendHour, row.sendHour2, row.sendHour3),
    notifyOnReady: row.notifyOnReady,
    notifyPush: row.notifyPush,
    notifyWhatsapp: row.notifyWhatsapp,
    discoveryLevel: row.discoveryLevel as DiscoveryLevel,
    briefLength: row.briefLength as BriefLength,
    localSourcesMigrated: row.localSourcesMigratedAt != null,
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

  const requestedSendHours =
    data.sendHours === undefined
      ? undefined
      : normalizeSendHours(
          data.sendHours[0] ?? 8,
          data.sendHours[1],
          data.sendHours[2]
        );
  const sendHour =
    requestedSendHours?.[0] ??
    (data.sendHour == null
      ? undefined
      : Math.min(23, Math.max(0, Math.trunc(data.sendHour))));

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
      sendHour2: requestedSendHours?.[1] ?? null,
      sendHour3: requestedSendHours?.[2] ?? null,
      notifyOnReady: data.notifyOnReady ?? true,
      notifyPush: data.notifyPush ?? true,
      notifyWhatsapp: data.notifyWhatsapp ?? true,
      discoveryLevel: data.discoveryLevel ?? "BALANCED",
      briefLength: data.briefLength ?? "NORMAL",
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
      ...(requestedSendHours !== undefined
        ? {
            sendHour2: requestedSendHours[1] ?? null,
            sendHour3: requestedSendHours[2] ?? null,
          }
        : {}),
      ...(data.notifyOnReady !== undefined
        ? { notifyOnReady: data.notifyOnReady }
        : {}),
      ...(data.notifyPush !== undefined ? { notifyPush: data.notifyPush } : {}),
      ...(data.notifyWhatsapp !== undefined ? { notifyWhatsapp: data.notifyWhatsapp } : {}),
      ...(data.discoveryLevel !== undefined
        ? { discoveryLevel: data.discoveryLevel }
        : {}),
      ...(data.briefLength !== undefined
        ? { briefLength: data.briefLength }
        : {}),
    },
  });

  return {
    topics: row.topics,
    priorityTopics: row.priorityTopics,
    language: row.language,
    country: row.country,
    isActive: row.isActive,
    sendHour: row.sendHour,
    sendHours: normalizeSendHours(row.sendHour, row.sendHour2, row.sendHour3),
    notifyOnReady: row.notifyOnReady,
    notifyPush: row.notifyPush,
    notifyWhatsapp: row.notifyWhatsapp,
    discoveryLevel: row.discoveryLevel as DiscoveryLevel,
    briefLength: row.briefLength as BriefLength,
    localSourcesMigrated: row.localSourcesMigratedAt != null,
  };
}

function serializeEdition(row: {
  id: string;
  date: Date | string;
  summary: string;
  articles: unknown;
  isRead: boolean;
  completedAt: Date | string | null;
  reviewedCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  briefItems: Parameters<typeof serializeBriefItem>[0][];
}): SerializedEdition {
  const articles = (row.articles as AnalyzedArticle[]) ?? [];
  const normalizedItems = row.briefItems.map(serializeBriefItem);
  const items =
    normalizedItems.length > 0
      ? normalizedItems
      : articles.map((article, index) => ({
          id: `legacy-news-${index}`,
          contentKey: `legacy-news-${index}`,
          kind: "NEWS" as const,
          sourceType: "NEWS" as const,
          sourceId: null,
          title: article.title,
          summary: article.summary,
          url: article.url,
          topic: article.topic,
          publishedAt: article.publishedAt,
          rank: index + 1,
          section: article.highlight ? ("KEYS" as const) : ("TOPICS" as const),
          inclusionReason: article.priority
            ? "Coincide con uno de tus temas prioritarios."
            : article.reputable
              ? "Proviene de una fuente reconocida."
              : null,
          metadata: {
            source: article.source,
            reputable: article.reputable,
            priority: article.priority,
          },
        }));
  return {
    id: row.id,
    date: row.date instanceof Date ? row.date.toISOString() : row.date,
    summary: row.summary,
    articles,
    isRead: row.isRead,
    completedAt:
      row.completedAt instanceof Date
        ? row.completedAt.toISOString()
        : row.completedAt,
    reviewedCount: row.reviewedCount,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    items,
  };
}

export async function getEditions(
  userId: string,
  limit = 30
): Promise<SerializedEdition[]> {
  const rows = await prisma.newsletterEdition.findMany({
    where: { userId },
    include: { briefItems: { orderBy: [{ section: "asc" }, { rank: "asc" }] } },
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
    include: { briefItems: { orderBy: [{ section: "asc" }, { rank: "asc" }] } },
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
    update: {
      summary,
      articles: articles as object[],
      isRead: false,
      completedAt: null,
    },
    include: { briefItems: true },
  });
  return serializeEdition(row);
}

export async function markEditionRead(
  userId: string,
  editionId: string
): Promise<void> {
  await prisma.newsletterEdition.updateMany({
    where: { id: editionId, userId },
    data: { isRead: true, completedAt: new Date() },
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
  sendHours: number[];
  notifyOnReady: boolean;
  notifyPush: boolean;
  notifyWhatsapp: boolean;
  discoveryLevel: DiscoveryLevel;
  briefLength: BriefLength;
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
      sendHour2: true,
      sendHour3: true,
      notifyOnReady: true,
      notifyPush: true,
      notifyWhatsapp: true,
      discoveryLevel: true,
      briefLength: true,
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
      sendHours: normalizeSendHours(r.sendHour, r.sendHour2, r.sendHour3),
      notifyOnReady: r.notifyOnReady,
      notifyPush: r.notifyPush,
      notifyWhatsapp: r.notifyWhatsapp,
      discoveryLevel: r.discoveryLevel as DiscoveryLevel,
      briefLength: r.briefLength as BriefLength,
      whatsappNumber: r.user?.whatsappNumber ?? null,
    }));
}

/** Configs activas cuyo horario de envío coincide con `hour` (0–23, ARG). */
export async function getConfigsForHour(hour: number): Promise<ActiveConfig[]> {
  const all = await getActiveConfigs();
  return all.filter((c) => c.sendHours.includes(hour));
}

/**
 * Reserva de forma atómica una ventana de aviso para evitar duplicados si el
 * pinger horario reintenta. La clave cambia por día y hora de Argentina.
 */
export async function claimDeliveryWindow(
  userId: string,
  hour: number
): Promise<boolean> {
  const key = `${todayStringArg()}:${String(hour).padStart(2, "0")}`;
  const result = await prisma.newsletterConfig.updateMany({
    where: {
      userId,
      OR: [{ lastDeliveryKey: null }, { lastDeliveryKey: { not: key } }],
    },
    data: { lastDeliveryKey: key },
  });
  return result.count === 1;
}
