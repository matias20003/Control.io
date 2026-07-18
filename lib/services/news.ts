// Ingesta de noticias vía Google News RSS.
// Sin API key, sin límite, sin registro. Devuelve noticias frescas por tema.

export type RawArticle = {
  title: string;
  url: string;
  source: string;
  topic: string;
  publishedAt: string | null; // ISO
  snippet: string;
  priority: boolean; // el tema fue marcado como prioritario por el usuario
};

function decodeEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "") // remove any residual html tags
    .trim();
}

const TAG_RE: Record<string, RegExp> = {
  title: /<title[^>]*>([\s\S]*?)<\/title>/i,
  link: /<link[^>]*>([\s\S]*?)<\/link>/i,
  source: /<source[^>]*>([\s\S]*?)<\/source>/i,
  pubDate: /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i,
  description: /<description[^>]*>([\s\S]*?)<\/description>/i,
};

function pick(block: string, tag: keyof typeof TAG_RE): string {
  const m = block.match(TAG_RE[tag]);
  return m ? m[1] : "";
}

/**
 * Trae hasta `limit` noticias recientes de Google News para un tema.
 * hl/gl/ceid configuran idioma y país (default español / Argentina).
 */
export async function fetchNewsForTopic(
  topic: string,
  opts: {
    language?: string;
    country?: string;
    limit?: number;
    priority?: boolean;
  } = {}
): Promise<RawArticle[]> {
  const lang = (opts.language ?? "es").toLowerCase();
  const country = (opts.country ?? "ar").toUpperCase();
  const limit = opts.limit ?? 8;
  const priority = opts.priority ?? false;

  // Google News usa hl=es-419 para español LATAM.
  const hl = lang === "es" ? "es-419" : lang;
  const ceid = `${country}:${lang}`;
  const q = encodeURIComponent(topic);
  const url = `https://news.google.com/rss/search?q=${q}&hl=${hl}&gl=${country}&ceid=${ceid}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; control.io-newsletter/1.0)" },
      next: { revalidate: 1800 }, // cache 30 min
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items = xml.split(/<item>/i).slice(1);
    const articles: RawArticle[] = [];

    for (const raw of items.slice(0, limit)) {
      const block = raw.split(/<\/item>/i)[0];

      const rawTitle = decodeEntities(pick(block, "title"));
      const link = decodeEntities(pick(block, "link"));
      if (!rawTitle || !link) continue;

      // Google News formatea el title como "Titular - Medio".
      let title = rawTitle;
      let source = decodeEntities(pick(block, "source"));
      const dash = rawTitle.lastIndexOf(" - ");
      if (!source && dash > 0) {
        source = rawTitle.slice(dash + 3).trim();
        title = rawTitle.slice(0, dash).trim();
      } else if (source && rawTitle.endsWith(` - ${source}`)) {
        title = rawTitle.slice(0, rawTitle.length - source.length - 3).trim();
      }

      const pubRaw = pick(block, "pubDate").trim();
      let publishedAt: string | null = null;
      if (pubRaw) {
        const d = new Date(pubRaw);
        if (!isNaN(d.getTime())) publishedAt = d.toISOString();
      }

      const snippet = decodeEntities(pick(block, "description")).slice(0, 300);

      articles.push({
        title,
        url: link,
        source: source || "Google News",
        topic,
        publishedAt,
        snippet,
        priority,
      });
    }

    return articles;
  } catch {
    return [];
  }
}

/**
 * Trae noticias para varios temas y las devuelve deduplicadas por título.
 * Los temas prioritarios (`priorityTopics`) traen más noticias por tema y
 * quedan marcados con `priority: true` para que la IA los pondere primero.
 */
export async function fetchNewsForTopics(
  topics: string[],
  opts: {
    language?: string;
    country?: string;
    perTopic?: number;
    priorityTopics?: string[];
    perPriorityTopic?: number;
  } = {}
): Promise<RawArticle[]> {
  const prioritySet = new Set(
    (opts.priorityTopics ?? []).map((t) => t.toLowerCase())
  );
  const results = await Promise.all(
    topics.map((t) => {
      const isPriority = prioritySet.has(t.toLowerCase());
      return fetchNewsForTopic(t, {
        language: opts.language,
        country: opts.country,
        limit: isPriority
          ? opts.perPriorityTopic ?? 12
          : opts.perTopic ?? 8,
        priority: isPriority,
      });
    })
  );

  const seen = new Set<string>();
  const merged: RawArticle[] = [];
  for (const list of results) {
    for (const a of list) {
      const key = a.title.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(a);
    }
  }
  return merged;
}
