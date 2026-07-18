import { prisma } from "@/lib/prisma";
import { startOfTodayArg, startOfDayArg } from "@/lib/timezone";
import type { AnalyzedArticle } from "@/lib/services/newsletter-ai";

export type SerializedConfig = {
  topics: string[];
  language: string;
  country: string;
  isActive: boolean;
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
  language: "es",
  country: "ar",
  isActive: true,
};

export async function getConfig(userId: string): Promise<SerializedConfig> {
  const row = await prisma.newsletterConfig.findUnique({ where: { userId } });
  if (!row) return DEFAULT_CONFIG;
  return {
    topics: row.topics,
    language: row.language,
    country: row.country,
    isActive: row.isActive,
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

  const row = await prisma.newsletterConfig.upsert({
    where: { userId },
    create: {
      userId,
      topics,
      language: data.language ?? "es",
      country: data.country ?? "ar",
      isActive: data.isActive ?? true,
    },
    update: {
      ...(data.topics !== undefined ? { topics } : {}),
      ...(data.language !== undefined ? { language: data.language } : {}),
      ...(data.country !== undefined ? { country: data.country } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  return {
    topics: row.topics,
    language: row.language,
    country: row.country,
    isActive: row.isActive,
  };
}

function serializeEdition(row: any): SerializedEdition {
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
    create: { userId, date, summary, articles: articles as any },
    update: { summary, articles: articles as any, isRead: false },
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

/** Configs activas con al menos un tema — para el cron diario. */
export async function getActiveConfigs(): Promise<
  { userId: string; topics: string[]; language: string; country: string }[]
> {
  const rows = await prisma.newsletterConfig.findMany({
    where: { isActive: true },
    select: { userId: true, topics: true, language: true, country: true },
  });
  return rows.filter((r) => r.topics.length > 0);
}
