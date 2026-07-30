import { createHash } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { startOfTodayArg } from "@/lib/timezone";
import {
  RADAR_LIMITS,
  type BriefPlatform,
  type BriefSourceCategory,
  type DiscoveryLevel,
  type SerializedBriefItem,
  type SerializedBriefSource,
  type SerializedDiscoveryCandidate,
} from "@/lib/brief/types";
import {
  normalizeSocialSource,
  sourceTypeForCategory,
} from "@/lib/brief/source-normalization";
import type { AnalyzedArticle } from "@/lib/services/newsletter-ai";
import { normalizeRadarProfileUrl } from "@/lib/services/brief/radar-ranking";

type SourceInput = {
  name: string;
  platform: string;
  handleOrUrl: string;
  category: BriefSourceCategory;
  priority: boolean;
};

function radarFeedbackTarget(profileUrl: string): string {
  return normalizeRadarProfileUrl(profileUrl) ?? profileUrl;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeSource(row: {
  id: string;
  name: string;
  sourceType: string;
  category: string;
  priority: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  socialAccounts: Array<{
    id: string;
    platform: string;
    handle: string;
    profileUrl: string;
    status: string;
    lastSyncedAt: Date | null;
  }>;
}): SerializedBriefSource {
  const account = row.socialAccounts[0] ?? null;
  return {
    id: row.id,
    name: row.name,
    sourceType: row.sourceType,
    category: row.category as BriefSourceCategory,
    priority: row.priority,
    isActive: row.isActive,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    account: account
      ? {
          id: account.id,
          platform: account.platform as BriefPlatform,
          handle: account.handle,
          profileUrl: account.profileUrl,
          status: account.status,
          lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
        }
      : null,
  };
}

const sourceInclude = {
  socialAccounts: {
    orderBy: { createdAt: "asc" as const },
    take: 1,
  },
};

export async function getBriefSources(
  userId: string
): Promise<SerializedBriefSource[]> {
  const rows = await prisma.briefSource.findMany({
    where: { userId },
    include: sourceInclude,
    orderBy: [{ priority: "desc" }, { isActive: "desc" }, { name: "asc" }],
  });
  return rows.map(serializeSource);
}

export async function createBriefSource(
  userId: string,
  input: SourceInput
): Promise<SerializedBriefSource> {
  const normalized = normalizeSocialSource(input.handleOrUrl, input.platform);
  if (!normalized) throw new Error("INVALID_SOURCE");

  const row = await prisma.briefSource.create({
    data: {
      userId,
      name: input.name.trim(),
      sourceType: sourceTypeForCategory(input.category),
      category: input.category,
      normalizedKey: normalized.normalizedKey,
      priority: input.priority,
      socialAccounts: {
        create: {
          platform: normalized.platform,
          handle: normalized.handle,
          profileUrl: normalized.profileUrl,
        },
      },
    },
    include: sourceInclude,
  });
  return serializeSource(row);
}

export async function updateBriefSource(
  userId: string,
  sourceId: string,
  input: SourceInput
): Promise<SerializedBriefSource | null> {
  const normalized = normalizeSocialSource(input.handleOrUrl, input.platform);
  if (!normalized) throw new Error("INVALID_SOURCE");

  const owned = await prisma.briefSource.findFirst({
    where: { id: sourceId, userId },
    select: { id: true, socialAccounts: { select: { id: true }, take: 1 } },
  });
  if (!owned) return null;

  await prisma.$transaction(async (tx) => {
    await tx.briefSource.update({
      where: { id: owned.id },
      data: {
        name: input.name.trim(),
        sourceType: sourceTypeForCategory(input.category),
        category: input.category,
        normalizedKey: normalized.normalizedKey,
        priority: input.priority,
      },
    });
    const account = owned.socialAccounts[0];
    if (account) {
      await tx.socialAccount.update({
        where: { id: account.id },
        data: {
          platform: normalized.platform,
          handle: normalized.handle,
          profileUrl: normalized.profileUrl,
          status: "PENDING",
        },
      });
    } else {
      await tx.socialAccount.create({
        data: {
          sourceId: owned.id,
          platform: normalized.platform,
          handle: normalized.handle,
          profileUrl: normalized.profileUrl,
        },
      });
    }
  });

  const row = await prisma.briefSource.findUnique({
    where: { id: owned.id },
    include: sourceInclude,
  });
  return row ? serializeSource(row) : null;
}

export async function setBriefSourceActive(
  userId: string,
  sourceId: string,
  isActive: boolean
): Promise<boolean> {
  const result = await prisma.briefSource.updateMany({
    where: { id: sourceId, userId },
    data: { isActive },
  });
  return result.count === 1;
}

export async function deleteBriefSource(
  userId: string,
  sourceId: string
): Promise<boolean> {
  const result = await prisma.briefSource.deleteMany({
    where: { id: sourceId, userId },
  });
  return result.count === 1;
}

export async function migrateLegacyBriefSources(
  userId: string,
  sources: Array<{
    name: string;
    handle: string;
    kind: "familiar" | "referente";
  }>
): Promise<{ imported: number; alreadyMigrated: boolean }> {
  const config = await prisma.newsletterConfig.findUnique({
    where: { userId },
    select: { localSourcesMigratedAt: true },
  });
  if (config?.localSourcesMigratedAt) {
    return { imported: 0, alreadyMigrated: true };
  }

  let imported = 0;
  await prisma.$transaction(async (tx) => {
    for (const legacy of sources) {
      const normalized = normalizeSocialSource(legacy.handle, "INSTAGRAM");
      if (!normalized) continue;

      const existing = await tx.briefSource.findUnique({
        where: {
          userId_normalizedKey: {
            userId,
            normalizedKey: normalized.normalizedKey,
          },
        },
        select: { id: true },
      });
      if (existing) continue;

      await tx.briefSource.create({
        data: {
          userId,
          name: legacy.name.trim() || `@${normalized.handle}`,
          sourceType: "PERSON",
          category: legacy.kind === "familiar" ? "CLOSE" : "REFERENCE",
          normalizedKey: normalized.normalizedKey,
          socialAccounts: {
            create: {
              platform: normalized.platform,
              handle: normalized.handle,
              profileUrl: normalized.profileUrl,
            },
          },
        },
      });
      imported += 1;
    }

    await tx.newsletterConfig.upsert({
      where: { userId },
      create: {
        userId,
        topics: [],
        priorityTopics: [],
        localSourcesMigratedAt: new Date(),
      },
      update: { localSourcesMigratedAt: new Date() },
    });
  });

  return { imported, alreadyMigrated: false };
}

function serializeCandidate(row: {
  id: string;
  candidateType: string;
  sourceName: string;
  platform: string | null;
  handle: string | null;
  profileUrl: string;
  topic: string | null;
  explanation: string;
  signals: unknown;
  status: string;
  date: Date;
}): SerializedDiscoveryCandidate {
  return {
    id: row.id,
    candidateType: row.candidateType,
    sourceName: row.sourceName,
    platform: row.platform as BriefPlatform | null,
    handle: row.handle,
    profileUrl: row.profileUrl,
    topic: row.topic,
    explanation: row.explanation,
    signals: (row.signals as Record<string, unknown> | null) ?? null,
    status: row.status,
    date: row.date.toISOString(),
  };
}

export async function getDiscoveryCandidates(
  userId: string,
  level: DiscoveryLevel
): Promise<SerializedDiscoveryCandidate[]> {
  const limit = RADAR_LIMITS[level];
  const rows = await prisma.discoveryCandidate.findMany({
    where: {
      userId,
      date: startOfTodayArg(),
      status: { in: ["PENDING", "TODAY_ONLY"] },
    },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: limit,
  });
  return rows.map(serializeCandidate);
}

export async function getDailyTrendCandidates(
  userId: string
): Promise<SerializedDiscoveryCandidate[]> {
  const rows = await prisma.discoveryCandidate.findMany({
    where: {
      userId,
      date: startOfTodayArg(),
      candidateType: "TREND",
      status: "PENDING",
    },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: 3,
  });
  return rows.map(serializeCandidate);
}

export async function updateDiscoveryCandidate(
  userId: string,
  candidateId: string,
  action: "ADD" | "TODAY_ONLY" | "DISMISS"
): Promise<SerializedBriefSource | null> {
  const candidate = await prisma.discoveryCandidate.findFirst({
    where: { id: candidateId, userId, status: "PENDING" },
  });
  if (!candidate) throw new Error("NOT_FOUND");

  if (action === "ADD") {
    const platform = candidate.platform ?? "WEB";
    const source = await createBriefSource(userId, {
      name: candidate.sourceName,
      platform,
      handleOrUrl: candidate.handle ?? candidate.profileUrl,
      category: candidate.candidateType === "MEDIA" ? "MEDIA" : "REFERENCE",
      priority: false,
    });
    await prisma.discoveryCandidate.update({
      where: { id: candidate.id },
      data: { status: "ADDED" },
    });
    await prisma.briefFeedback.upsert({
      where: {
        userId_targetType_targetId_action: {
          userId,
          targetType: "DISCOVERY",
          targetId: radarFeedbackTarget(candidate.profileUrl),
          action: "ADDED",
        },
      },
      create: {
        userId,
        targetType: "DISCOVERY",
        targetId: radarFeedbackTarget(candidate.profileUrl),
        action: "ADDED",
      },
      update: {},
    });
    return source;
  }

  const feedbackAction =
    action === "TODAY_ONLY" ? "TODAY_ONLY" : "NOT_INTERESTED";
  await prisma.$transaction(async (tx) => {
    await tx.discoveryCandidate.update({
      where: { id: candidate.id },
      data: { status: action === "TODAY_ONLY" ? "TODAY_ONLY" : "DISMISSED" },
    });
    await tx.briefFeedback.upsert({
      where: {
        userId_targetType_targetId_action: {
          userId,
          targetType: "DISCOVERY",
            targetId: radarFeedbackTarget(candidate.profileUrl),
          action: feedbackAction,
        },
      },
      create: {
        userId,
        targetType: "DISCOVERY",
          targetId: radarFeedbackTarget(candidate.profileUrl),
        action: feedbackAction,
      },
      update: {},
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  });
  return null;
}

function contentKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

export async function syncNewsBriefItems(
  editionId: string,
  articles: AnalyzedArticle[]
): Promise<void> {
  const activeKeys = articles.map((article) => contentKey(article.url));
  await prisma.$transaction([
    prisma.briefItem.deleteMany({
      where: {
        editionId,
        kind: "NEWS",
        contentKey: { notIn: activeKeys },
      },
    }),
    ...articles.map((article, index) =>
      prisma.briefItem.upsert({
        where: {
          editionId_contentKey: {
            editionId,
            contentKey: contentKey(article.url),
          },
        },
        create: {
          editionId,
          contentKey: contentKey(article.url),
          kind: "NEWS",
          sourceType: "NEWS",
          title: article.title,
          summary: article.summary,
          url: article.url,
          topic: article.topic,
          publishedAt: article.publishedAt
            ? new Date(article.publishedAt)
            : null,
          rank: index + 1,
          section: article.highlight ? "KEYS" : "TOPICS",
          inclusionReason: article.priority
            ? "Coincide con uno de tus temas prioritarios."
            : article.reputable
              ? "Proviene de una fuente reconocida."
              : null,
          metadata: {
            source: article.source,
            sourceUrl: article.sourceUrl ?? null,
            reputable: article.reputable,
            priority: article.priority,
          },
        },
        update: {
          title: article.title,
          summary: article.summary,
          topic: article.topic,
          publishedAt: article.publishedAt
            ? new Date(article.publishedAt)
            : null,
          rank: index + 1,
          section: article.highlight ? "KEYS" : "TOPICS",
          inclusionReason: article.priority
            ? "Coincide con uno de tus temas prioritarios."
            : article.reputable
              ? "Proviene de una fuente reconocida."
              : null,
          metadata: {
            source: article.source,
            sourceUrl: article.sourceUrl ?? null,
            reputable: article.reputable,
            priority: article.priority,
          },
        },
      })
    ),
  ]);
}

export function serializeBriefItem(row: {
  id: string;
  contentKey: string;
  kind: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  summary: string;
  url: string;
  topic: string | null;
  publishedAt: Date | null;
  rank: number;
  section: string;
  inclusionReason: string | null;
  metadata: unknown;
}): SerializedBriefItem {
  return {
    id: row.id,
    contentKey: row.contentKey,
    kind: row.kind as SerializedBriefItem["kind"],
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    title: row.title,
    summary: row.summary,
    url: row.url,
    topic: row.topic,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    rank: row.rank,
    section: row.section as SerializedBriefItem["section"],
    inclusionReason: row.inclusionReason,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  } as SerializedBriefItem;
}

export async function recordBriefItemOpened(
  userId: string,
  editionId: string,
  url: string
): Promise<number> {
  const targetId = `${editionId}:${contentKey(url)}`;
  return prisma.$transaction(async (tx) => {
    const edition = await tx.newsletterEdition.findFirst({
      where: { id: editionId, userId },
      select: { id: true, reviewedCount: true },
    });
    if (!edition) throw new Error("NOT_FOUND");

    const existing = await tx.briefFeedback.findUnique({
      where: {
        userId_targetType_targetId_action: {
          userId,
          targetType: "BRIEF_ITEM",
          targetId,
          action: "OPENED",
        },
      },
      select: { id: true },
    });
    if (existing) return edition.reviewedCount;

    await tx.briefFeedback.create({
      data: {
        userId,
        targetType: "BRIEF_ITEM",
        targetId,
        action: "OPENED",
      },
    });
    const updated = await tx.newsletterEdition.update({
      where: { id: edition.id },
      data: { reviewedCount: { increment: 1 } },
      select: { reviewedCount: true },
    });
    return updated.reviewedCount;
  });
}

export async function reopenBriefEdition(
  userId: string,
  editionId: string
): Promise<boolean> {
  const result = await prisma.newsletterEdition.updateMany({
    where: { id: editionId, userId },
    data: { isRead: false, completedAt: null },
  });
  return result.count === 1;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
