import { prisma } from "@/lib/prisma";
import { startOfTodayArg } from "@/lib/timezone";
import { RADAR_LIMITS, type DiscoveryLevel } from "@/lib/brief/types";
import { fetchNewsForTopics, type RawArticle } from "@/lib/services/news";
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
