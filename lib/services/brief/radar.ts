import { prisma } from "@/lib/prisma";
import { startOfTodayArg } from "@/lib/timezone";
import { RADAR_LIMITS, type DiscoveryLevel } from "@/lib/brief/types";
import {
  fetchNewsForTopics,
  fetchTopNews,
  type RawArticle,
} from "@/lib/services/news";
import { buildRadarCandidates } from "@/lib/services/brief/radar-ranking";

export type RadarGenerationResult = {
  created: number;
  reason: "INSUFFICIENT_SIGNALS" | "READY";
};

export type RadarGenerationContext = {
  articles: RawArticle[];
  priorityTopics: string[];
};

type EnsureRadarInput = {
  level: DiscoveryLevel;
  topics: string[];
  priorityTopics: string[];
  language: string;
  country: string;
};

type EnsureDailyTrendsInput = {
  language: string;
  country: string;
};

function articleAgeHours(article: RawArticle): number {
  if (!article.publishedAt) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(article.publishedAt);
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - timestamp) / 3_600_000);
}

function selectDailyTrends(articles: RawArticle[]): RawArticle[] {
  const fresh = articles
    .filter((article) => articleAgeHours(article) <= 36)
    .sort((a, b) => {
      if (a.reputable !== b.reputable) return a.reputable ? -1 : 1;
      return articleAgeHours(a) - articleAgeHours(b);
    });
  const selected: RawArticle[] = [];
  const sources = new Set<string>();

  for (const article of fresh) {
    const sourceKey = article.source.trim().toLocaleLowerCase("es");
    if (sources.has(sourceKey)) continue;
    selected.push(article);
    sources.add(sourceKey);
    if (selected.length === 3) return selected;
  }

  for (const article of fresh) {
    if (selected.some((item) => item.url === article.url)) continue;
    selected.push(article);
    if (selected.length === 3) break;
  }
  return selected;
}

/**
 * Genera el panorama general del día para Mi Círculo.
 * Es deliberadamente independiente de referentes, temas y feedback personal.
 */
export async function ensureDailyTrendsForUser(
  userId: string,
  input: EnsureDailyTrendsInput
): Promise<RadarGenerationResult> {
  const date = startOfTodayArg();
  const existing = await prisma.discoveryCandidate.count({
    where: { userId, date, candidateType: "TREND", status: "PENDING" },
  });
  if (existing >= 3) return { created: 0, reason: "READY" };

  const articles = await fetchTopNews({
    language: input.language,
    country: input.country,
    limit: 30,
  });
  const trends = selectDailyTrends(articles);
  const activeUrls = trends.map((article) => article.url);

  await prisma.$transaction([
    prisma.discoveryCandidate.deleteMany({
      where: {
        userId,
        date,
        status: "PENDING",
        ...(activeUrls.length > 0
          ? { profileUrl: { notIn: activeUrls } }
          : {}),
      },
    }),
    ...trends.map((article, index) =>
      prisma.discoveryCandidate.upsert({
        where: {
          userId_date_profileUrl: {
            userId,
            date,
            profileUrl: article.url,
          },
        },
        create: {
          userId,
          date,
          candidateType: "TREND",
          sourceName: article.source,
          platform: "WEB",
          profileUrl: article.url,
          topic: article.title,
          score: 100 - index,
          explanation:
            article.snippet && article.snippet !== article.title
              ? article.snippet
              : "Es una de las noticias principales de la agenda general de hoy.",
          signals: {
            articleCount: 1,
            reputable: article.reputable,
            latestPublishedAt: article.publishedAt,
            geography: input.country.toUpperCase(),
            headline: article.title,
            source: article.source,
          },
        },
        update: {
          candidateType: "TREND",
          sourceName: article.source,
          platform: "WEB",
          topic: article.title,
          score: 100 - index,
          explanation:
            article.snippet && article.snippet !== article.title
              ? article.snippet
              : "Es una de las noticias principales de la agenda general de hoy.",
          signals: {
            articleCount: 1,
            reputable: article.reputable,
            latestPublishedAt: article.publishedAt,
            geography: input.country.toUpperCase(),
            headline: article.title,
            source: article.source,
          },
        },
      })
    ),
  ]);

  return trends.length > 0
    ? { created: trends.length, reason: "READY" }
    : { created: 0, reason: "INSUFFICIENT_SIGNALS" };
}

export async function generateRadarForUser(
  userId: string,
  level: DiscoveryLevel,
  context: RadarGenerationContext
): Promise<RadarGenerationResult> {
  const date = startOfTodayArg();
  const limit = RADAR_LIMITS[level];
  const [sources, previousDecisions] = await Promise.all([
    prisma.briefSource.findMany({
      where: { userId },
      select: {
        name: true,
        socialAccounts: { select: { profileUrl: true } },
      },
    }),
    prisma.discoveryCandidate.findMany({
      where: {
        userId,
        status: { in: ["ADDED", "DISMISSED"] },
      },
      select: { profileUrl: true },
    }),
  ]);

  const excludedProfileUrls = [
    ...sources.flatMap((source) =>
      source.socialAccounts.map((account) => account.profileUrl)
    ),
    ...previousDecisions.map((candidate) => candidate.profileUrl),
  ];
  const excludedSourceNames = sources.map((source) => source.name);
  const candidates = buildRadarCandidates({
    articles: context.articles,
    priorityTopics: context.priorityTopics,
    level,
    limit,
    excludedProfileUrls,
    excludedSourceNames,
  });
  const activeUrls = candidates.map((candidate) => candidate.profileUrl);

  await prisma.$transaction([
    prisma.discoveryCandidate.deleteMany({
      where: {
        userId,
        date,
        status: "PENDING",
        candidateType: { not: "TREND" },
        ...(activeUrls.length > 0
          ? { profileUrl: { notIn: activeUrls } }
          : {}),
      },
    }),
    ...candidates.map((candidate) =>
      prisma.discoveryCandidate.upsert({
        where: {
          userId_date_profileUrl: {
            userId,
            date,
            profileUrl: candidate.profileUrl,
          },
        },
        create: {
          userId,
          date,
          candidateType: candidate.candidateType,
          sourceName: candidate.sourceName,
          platform: candidate.platform,
          handle: candidate.handle,
          profileUrl: candidate.profileUrl,
          topic: candidate.topic,
          score: candidate.score,
          explanation: candidate.explanation,
          signals: candidate.signals,
        },
        update: {
          candidateType: candidate.candidateType,
          sourceName: candidate.sourceName,
          platform: candidate.platform,
          handle: candidate.handle,
          topic: candidate.topic,
          score: candidate.score,
          explanation: candidate.explanation,
          signals: candidate.signals,
        },
      })
    ),
  ]);

  return candidates.length > 0
    ? { created: candidates.length, reason: "READY" }
    : { created: 0, reason: "INSUFFICIENT_SIGNALS" };
}

export async function ensureRadarForUser(
  userId: string,
  input: EnsureRadarInput
): Promise<RadarGenerationResult> {
  if (input.topics.length === 0) {
    return { created: 0, reason: "INSUFFICIENT_SIGNALS" };
  }

  const date = startOfTodayArg();
  const existing = await prisma.discoveryCandidate.count({
    where: { userId, date },
  });
  if (existing > 0) {
    return { created: 0, reason: "READY" };
  }

  const articles = await fetchNewsForTopics(input.topics, {
    language: input.language,
    country: input.country,
    perTopic: 6,
    priorityTopics: input.priorityTopics,
    perPriorityTopic: 8,
  });
  return generateRadarForUser(userId, input.level, {
    articles,
    priorityTopics: input.priorityTopics,
  });
}
