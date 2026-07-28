import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  BRIEF_LENGTH_LIMITS,
  type BriefLength,
  type BriefPlatform,
} from "@/lib/brief/types";
import { getSocialContentProvider } from "@/lib/services/social/provider";
import type {
  NormalizedSocialPost,
  SocialAccountReference,
  SocialProviderResult,
} from "@/lib/services/social/types";

function contentKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

async function activeAccounts(
  userId: string
): Promise<SocialAccountReference[]> {
  const rows = await prisma.socialAccount.findMany({
    where: { source: { userId, isActive: true } },
    include: {
      source: {
        select: { id: true, name: true, priority: true },
      },
    },
    orderBy: [
      { source: { priority: "desc" } },
      { source: { name: "asc" } },
    ],
  });
  return rows.map((row) => ({
    accountId: row.id,
    sourceId: row.source.id,
    sourceName: row.source.name,
    platform: row.platform as BriefPlatform,
    handle: row.handle,
    profileUrl: row.profileUrl,
    priority: row.source.priority,
  }));
}

function byRecency(
  a: NormalizedSocialPost,
  b: NormalizedSocialPost
): number {
  return (
    (b.publishedAt ? Date.parse(b.publishedAt) : 0) -
    (a.publishedAt ? Date.parse(a.publishedAt) : 0)
  );
}

export async function refreshSocialContentForEdition(
  userId: string,
  editionId: string,
  briefLength: BriefLength
): Promise<SocialProviderResult & { saved: number }> {
  const accounts = await activeAccounts(userId);
  if (accounts.length === 0) {
    return {
      status: "unavailable",
      posts: [],
      reason: "El usuario todavía no agregó fuentes.",
      saved: 0,
    };
  }

  const result = await getSocialContentProvider().fetchRecent(accounts);
  if (result.status !== "ok") return { ...result, saved: 0 };

  const accountById = new Map(accounts.map((account) => [account.accountId, account]));
  const allowed = result.posts
    .filter((post) => accountById.has(post.accountId))
    .sort((a, b) => {
      const accountA = accountById.get(a.accountId);
      const accountB = accountById.get(b.accountId);
      if (accountA?.priority !== accountB?.priority) {
        return accountA?.priority ? -1 : 1;
      }
      return byRecency(a, b);
    })
    .slice(0, BRIEF_LENGTH_LIMITS[briefLength].social);

  let saved = 0;
  await prisma.$transaction(async (tx) => {
    await tx.briefItem.deleteMany({
      where: {
        editionId,
        kind: "SOCIAL",
        contentKey: { notIn: allowed.map((post) => contentKey(post.url)) },
      },
    });
    for (const [index, post] of allowed.entries()) {
      const account = accountById.get(post.accountId);
      if (!account) continue;

      const socialPost = await tx.socialPost.upsert({
        where: {
          accountId_externalId: {
            accountId: post.accountId,
            externalId: post.externalId,
          },
        },
        create: {
          accountId: post.accountId,
          externalId: post.externalId,
          url: post.url,
          title: post.title,
          thumbnailUrl: post.thumbnailUrl,
          publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
          metrics: post.metrics ?? undefined,
          topicSignals: post.topicSignals,
        },
        update: {
          url: post.url,
          title: post.title,
          thumbnailUrl: post.thumbnailUrl,
          publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
          metrics: post.metrics ?? undefined,
          topicSignals: post.topicSignals,
          fetchedAt: new Date(),
        },
      });

      await tx.socialAccount.update({
        where: { id: post.accountId },
        data: { status: "ACTIVE", lastSyncedAt: new Date() },
      });

      await tx.briefItem.upsert({
        where: {
          editionId_contentKey: {
            editionId,
            contentKey: contentKey(post.url),
          },
        },
        create: {
          editionId,
          contentKey: contentKey(post.url),
          kind: "SOCIAL",
          sourceType: account.platform,
          sourceId: account.sourceId,
          socialPostId: socialPost.id,
          title: post.title,
          summary: post.title,
          url: post.url,
          topic: post.topicSignals[0] ?? null,
          publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
          rank: index + 1,
          section: "SOURCES",
          inclusionReason: "Está en tus fuentes.",
          metadata: {
            author: account.sourceName,
            handle: account.handle,
            platform: account.platform,
            thumbnailUrl: post.thumbnailUrl,
            metrics: post.metrics,
          },
        },
        update: {
          title: post.title,
          summary: post.title,
          topic: post.topicSignals[0] ?? null,
          publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
          rank: index + 1,
          metadata: {
            author: account.sourceName,
            handle: account.handle,
            platform: account.platform,
            thumbnailUrl: post.thumbnailUrl,
            metrics: post.metrics,
          },
        },
      });
      saved += 1;
    }
  });

  return { ...result, saved };
}
