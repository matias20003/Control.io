import type { DiscoveryLevel } from "@/lib/brief/types";
import type { RawArticle } from "@/lib/services/news";

export type RadarCandidateDraft = {
  candidateType: "MEDIA";
  sourceName: string;
  platform: "WEB";
  handle: null;
  profileUrl: string;
  topic: string | null;
  score: number;
  explanation: string;
  signals: {
    articleCount: number;
    topics: string[];
    priorityTopics: string[];
    reputable: boolean;
    latestPublishedAt: string | null;
  };
};

type BuildRadarCandidatesInput = {
  articles: RawArticle[];
  priorityTopics: string[];
  level: DiscoveryLevel;
  limit: number;
  excludedProfileUrls?: Iterable<string>;
  excludedSourceNames?: Iterable<string>;
};

type SourceGroup = {
  sourceName: string;
  profileUrl: string;
  articles: RawArticle[];
};

const CLICKBAIT_RE =
  /\b(impactante|incre[ií]ble|no vas a creer|urgente|esc[aá]ndalo|bomba|viral|shocking|you won'?t believe)\b/i;
const PROMOTION_RE =
  /\b(compr[aá]|oferta|descuento|sorteo|patrocinado|inscribite|curso|promo(?:ci[oó]n)?)\b/i;

function normalizeText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeRadarProfileUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    url.protocol = "https:";
    url.search = "";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    if (url.hostname === "news.google.com") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function recencyScore(articles: RawArticle[]): {
  score: number;
  latestPublishedAt: string | null;
} {
  const latest = articles.reduce<number | null>((current, article) => {
    if (!article.publishedAt) return current;
    const timestamp = Date.parse(article.publishedAt);
    if (!Number.isFinite(timestamp)) return current;
    return current == null || timestamp > current ? timestamp : current;
  }, null);
  if (latest == null) return { score: 0, latestPublishedAt: null };

  const ageHours = Math.max(0, (Date.now() - latest) / 3_600_000);
  const score = ageHours <= 12 ? 12 : ageHours <= 36 ? 8 : ageHours <= 72 ? 4 : 0;
  return { score, latestPublishedAt: new Date(latest).toISOString() };
}

function topicCounts(articles: RawArticle[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const article of articles) {
    const topic = article.topic.trim();
    if (!topic) continue;
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return counts;
}

function explanationFor(
  articleCount: number,
  topics: string[],
  priorityMatches: string[],
  reputable: boolean
): string {
  const topicText =
    topics.length === 0
      ? "tus temas"
      : topics.length === 1
        ? topics[0]
        : `${topics[0]} y ${topics[1]}`;
  const firstSentence =
    articleCount === 1
      ? `Apareció con una noticia relevante sobre ${topicText} en el relevamiento de hoy.`
      : `Apareció en ${articleCount} noticias relevantes sobre ${topicText} en el relevamiento de hoy.`;
  const prioritySentence =
    priorityMatches.length === 0
      ? ""
      : priorityMatches.length === 1
        ? ` Coincide con tu tema prioritario ${priorityMatches[0]}.`
        : ` Coincide con tus temas prioritarios ${priorityMatches.slice(0, 2).join(" y ")}.`;
  const trustSentence = reputable
    ? " El filtro editorial la reconoce como una fuente estable."
    : "";
  return `${firstSentence}${prioritySentence}${trustSentence}`;
}

function thresholdFor(level: DiscoveryLevel): number {
  if (level === "CONSERVATIVE") return 65;
  if (level === "BALANCED") return 50;
  return 42;
}

export function buildRadarCandidates({
  articles,
  priorityTopics,
  level,
  limit,
  excludedProfileUrls = [],
  excludedSourceNames = [],
}: BuildRadarCandidatesInput): RadarCandidateDraft[] {
  if (limit <= 0) return [];

  const excludedUrls = new Set(
    Array.from(excludedProfileUrls)
      .map((value) => normalizeRadarProfileUrl(value))
      .filter((value): value is string => value != null)
  );
  const excludedNames = new Set(
    Array.from(excludedSourceNames).map(normalizeText).filter(Boolean)
  );
  const prioritySet = new Set(priorityTopics.map(normalizeText));
  const groups = new Map<string, SourceGroup>();

  for (const article of articles) {
    const profileUrl = normalizeRadarProfileUrl(article.sourceUrl);
    const sourceName = article.source.trim();
    if (!profileUrl || !sourceName || normalizeText(sourceName) === "google news") {
      continue;
    }
    if (excludedUrls.has(profileUrl) || excludedNames.has(normalizeText(sourceName))) {
      continue;
    }
    const existing = groups.get(profileUrl);
    if (existing) {
      existing.articles.push(article);
    } else {
      groups.set(profileUrl, { sourceName, profileUrl, articles: [article] });
    }
  }

  const ranked = Array.from(groups.values())
    .map((group): RadarCandidateDraft | null => {
      const counts = topicCounts(group.articles);
      const topics = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
        .map(([topic]) => topic);
      const priorityMatches = topics.filter((topic) =>
        prioritySet.has(normalizeText(topic))
      );
      const reputableCount = group.articles.filter((article) => article.reputable).length;
      const reputable = reputableCount >= Math.ceil(group.articles.length / 2);
      const clickbaitCount = group.articles.filter((article) =>
        CLICKBAIT_RE.test(article.title)
      ).length;
      const promotionCount = group.articles.filter((article) =>
        PROMOTION_RE.test(article.title)
      ).length;
      const recency = recencyScore(group.articles);
      const score =
        Math.min(topics.length, 3) * 18 +
        Math.min(group.articles.length, 4) * 7 +
        (priorityMatches.length > 0 ? 20 : 0) +
        (reputable ? 16 : 0) +
        recency.score -
        Math.min(clickbaitCount * 14, 28) -
        Math.min(promotionCount * 12, 24);

      if (score < thresholdFor(level)) return null;

      return {
        candidateType: "MEDIA",
        sourceName: group.sourceName,
        platform: "WEB",
        handle: null,
        profileUrl: group.profileUrl,
        topic: priorityMatches[0] ?? topics[0] ?? null,
        score,
        explanation: explanationFor(
          group.articles.length,
          topics,
          priorityMatches,
          reputable
        ),
        signals: {
          articleCount: group.articles.length,
          topics,
          priorityTopics: priorityMatches,
          reputable,
          latestPublishedAt: recency.latestPublishedAt,
        },
      };
    })
    .filter((candidate): candidate is RadarCandidateDraft => candidate != null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.sourceName.localeCompare(b.sourceName, "es", { sensitivity: "base" })
    );

  const selected: RadarCandidateDraft[] = [];
  const selectedTopics = new Set<string>();
  for (const candidate of ranked) {
    const topicKey = normalizeText(candidate.topic ?? "");
    if (topicKey && selectedTopics.has(topicKey)) continue;
    selected.push(candidate);
    if (topicKey) selectedTopics.add(topicKey);
    if (selected.length === limit) return selected;
  }
  for (const candidate of ranked) {
    if (selected.some((item) => item.profileUrl === candidate.profileUrl)) continue;
    selected.push(candidate);
    if (selected.length === limit) break;
  }
  return selected;
}
