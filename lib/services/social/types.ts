import type { BriefPlatform } from "@/lib/brief/types";

export type SocialAccountReference = {
  accountId: string;
  sourceId: string;
  sourceName: string;
  platform: BriefPlatform;
  handle: string;
  profileUrl: string;
  priority: boolean;
};

export type NormalizedSocialPost = {
  accountId: string;
  externalId: string;
  url: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  metrics: Record<string, number> | null;
  topicSignals: string[];
};

export type SocialProviderResult =
  | { status: "ok"; posts: NormalizedSocialPost[] }
  | { status: "unavailable"; posts: []; reason: string }
  | { status: "error"; posts: []; reason: string };

export interface SocialContentProvider {
  fetchRecent(
    accounts: SocialAccountReference[]
  ): Promise<SocialProviderResult>;
}
