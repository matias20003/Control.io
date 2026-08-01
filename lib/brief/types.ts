export const BRIEF_PLATFORMS = [
  "INSTAGRAM",
  "YOUTUBE",
  "TIKTOK",
  "X",
  "LINKEDIN",
  "WEB",
] as const;

export const BRIEF_SOURCE_CATEGORIES = [
  "CLOSE",
  "REFERENCE",
  "MEDIA",
  "COMPETITOR",
  "INSPIRATION",
] as const;

export const DISCOVERY_LEVELS = [
  "CONSERVATIVE",
  "BALANCED",
  "EXPLORER",
] as const;

export const BRIEF_LENGTHS = ["SHORT", "NORMAL", "WIDE"] as const;

export type BriefPlatform = (typeof BRIEF_PLATFORMS)[number];
export type BriefSourceCategory = (typeof BRIEF_SOURCE_CATEGORIES)[number];
export type DiscoveryLevel = (typeof DISCOVERY_LEVELS)[number];
export type BriefLength = (typeof BRIEF_LENGTHS)[number];

/** CHANNEL = lo publicado por un referente en su propio canal abierto. */
export type BriefItemKind = "NEWS" | "SOCIAL" | "DISCOVERY" | "CHANNEL";
export type BriefItemSection = "KEYS" | "SOURCES" | "TOPICS" | "RADAR";

type SerializedBriefItemBase = {
  id: string;
  contentKey: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  summary: string;
  url: string;
  topic: string | null;
  publishedAt: string | null;
  rank: number;
  section: BriefItemSection;
  inclusionReason: string | null;
  metadata: Record<string, unknown> | null;
};

export type NewsBriefItem = SerializedBriefItemBase & {
  kind: "NEWS";
  sourceType: "NEWS";
};

export type SocialBriefItem = SerializedBriefItemBase & {
  kind: "SOCIAL";
  sourceType: BriefPlatform;
};

export type DiscoveryBriefItem = SerializedBriefItemBase & {
  kind: "DISCOVERY";
};

/** Una publicación del canal propio de un referente (blog, YouTube, podcast). */
export type ChannelBriefItem = SerializedBriefItemBase & {
  kind: "CHANNEL";
};

export type SerializedBriefItem =
  | NewsBriefItem
  | SocialBriefItem
  | DiscoveryBriefItem
  | ChannelBriefItem;

export type SerializedBriefSource = {
  id: string;
  name: string;
  sourceType: string;
  category: BriefSourceCategory;
  priority: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  account: {
    id: string;
    platform: BriefPlatform;
    handle: string;
    profileUrl: string;
    status: string;
    lastSyncedAt: string | null;
  } | null;
};

export type SerializedDiscoveryCandidate = {
  id: string;
  candidateType: string;
  sourceName: string;
  platform: BriefPlatform | null;
  handle: string | null;
  profileUrl: string;
  topic: string | null;
  explanation: string;
  signals: Record<string, unknown> | null;
  status: string;
  date: string;
};

export const BRIEF_LENGTH_LIMITS: Record<
  BriefLength,
  { total: number; perTopic: number; social: number }
> = {
  SHORT: { total: 6, perTopic: 2, social: 3 },
  NORMAL: { total: 10, perTopic: 3, social: 5 },
  WIDE: { total: 15, perTopic: 3, social: 8 },
};

export const RADAR_LIMITS: Record<DiscoveryLevel, number> = {
  CONSERVATIVE: 1,
  BALANCED: 2,
  EXPLORER: 3,
};
