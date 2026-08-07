// Ingesta de noticias vía Google News RSS.
// Sin API key, sin límite, sin registro. Devuelve noticias frescas por tema.

export type RawArticle = {
  title: string;
  url: string;
  source: string;
  sourceUrl?: string | null;
  topic: string;
  publishedAt: string | null; // ISO
  snippet: string;
  priority: boolean; // el tema fue marcado como prioritario por el usuario
  reputable: boolean; // la fuente es un medio reconocido/confiable
};

// Medios reconocidos (AR + internacionales + tech serios). Es una señal de
// confianza, no una verdad absoluta: una fuente desconocida NO es
// necesariamente falsa, pero una reconocida rara vez publica algo inventado.
// Se matchea por substring, sin acentos ni mayúsculas.
const REPUTABLE_SOURCES = [
  // Argentina
  "clarin", "la nacion", "infobae", "pagina", "ambito", "el cronista",
  "perfil", "todo noticias", "tn.com", "la voz", "los andes", "iprofesional",
  "telam", "chequeado", "el destape", "cenital", "letra p", "bae negocios",
  // Internacional (ES / global)
  "reuters", "associated press", "ap news", "afp", "bbc", "el pais",
  "el mundo", "the new york times", "nytimes", "the guardian", "washington post",
  "bloomberg", "financial times", "the economist", "cnn", "deutsche welle",
  " dw", "france 24", "euronews", "abc.es", "el confidencial", "el universal",
  "la vanguardia", "20minutos", "reforma", "milenio",
  // Tech / negocios serios
  "wired", "the verge", "techcrunch", "ars technica", "mit technology",
  "xataka", "wall street journal", "wsj", "forbes", "cnbc", "engadget",
];

function normalizeSource(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // saca acentos
}

export function isReputableSource(source: string): boolean {
  const s = normalizeSource(source);
  return REPUTABLE_SOURCES.some((r) => s.includes(r));
}

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

const SOURCE_URL_RE = /<source[^>]*\surl=["']([^"']+)["'][^>]*>/i;

function pick(block: string, tag: keyof typeof TAG_RE): string {
  const m = block.match(TAG_RE[tag]);
  return m ? m[1] : "";
}

function pickSourceUrl(block: string): string | null {
  const value = decodeEntities(block.match(SOURCE_URL_RE)?.[1] ?? "");
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.protocol = "https:";
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

function parseGoogleNewsItems(
  xml: string,
  topic: string,
  limit: number,
  priority: boolean
): RawArticle[] {
  const items = xml.split(/<item>/i).slice(1);
  const articles: RawArticle[] = [];

  for (const raw of items.slice(0, limit)) {
    const block = raw.split(/<\/item>/i)[0];
    const rawTitle = decodeEntities(pick(block, "title"));
    const link = decodeEntities(pick(block, "link"));
    if (!rawTitle || !link) continue;

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
      const date = new Date(pubRaw);
      if (!Number.isNaN(date.getTime())) publishedAt = date.toISOString();
    }

    const finalSource = source || "Google News";
    articles.push({
      title,
      url: link,
      source: finalSource,
      sourceUrl: pickSourceUrl(block),
      topic,
      publishedAt,
      snippet: decodeEntities(pick(block, "description")).slice(0, 300),
      priority,
      reputable: isReputableSource(finalSource),
    });
  }

  return articles;
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

    return parseGoogleNewsItems(xml, topic, limit, priority);
  } catch {
    return [];
  }
}

/**
 * Trae la portada general de Google News para el país configurado.
 * No depende de los temas ni de las fuentes elegidas por el usuario.
 */
export async function fetchTopNews(
  opts: {
    language?: string;
    country?: string;
    limit?: number;
  } = {}
): Promise<RawArticle[]> {
  const lang = (opts.language ?? "es").toLowerCase();
  const country = (opts.country ?? "ar").toUpperCase();
  const limit = opts.limit ?? 24;
  const hl = lang === "es" ? "es-419" : lang;
  const ceid = `${country}:${lang}`;
  const url = `https://news.google.com/rss?hl=${hl}&gl=${country}&ceid=${ceid}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; control.io-radar/1.0)",
      },
      next: { revalidate: 1800 },
    });
    if (!response.ok) return [];
    return parseGoogleNewsItems(
      await response.text(),
      "Actualidad general",
      limit,
      false
    );
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
