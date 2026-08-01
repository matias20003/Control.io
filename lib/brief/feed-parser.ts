/**
 * Parser de RSS 2.0 y Atom, sin dependencias.
 *
 * Es a propósito tolerante: los feeds del mundo real vienen con CDATA, HTML
 * adentro de los títulos, entidades a medio escapar y campos faltantes. Ante la
 * duda descarta la entrada en vez de inventar datos — una fuente que devuelve
 * basura tiene que verse vacía, no plausible.
 *
 * No toca la red: recibe el XML como string. Ver lib/services/brief/channels.ts
 * para la parte que sí sale a buscar.
 */

export type ParsedFeedItem = {
  /** Identificador estable dentro del feed: guid/id, o la URL como respaldo. */
  externalId: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date | null;
};

export type ParsedFeed = {
  title: string | null;
  items: ParsedFeedItem[];
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

/**
 * Saca CDATA, etiquetas HTML y espacios de más.
 *
 * Hay dos pasadas de limpieza de etiquetas a propósito: media web publica
 * descripciones con el HTML escapado (`&lt;p&gt;`), así que recién queda a la
 * vista después de decodificar las entidades. Una sola pasada lo dejaría pasar.
 */
export function cleanText(value: string | null): string {
  if (!value) return "";
  const sinCdata = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const sinTags = sinCdata.replace(/<[^>]*>/g, " ");
  return decodeEntities(sinTags)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bloques `<tag …>…</tag>` de primer nivel de aparición. */
function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  const found: string[] = [];
  for (const match of xml.matchAll(re)) found.push(match[1]);
  return found;
}

/** Texto del primer `<tag>` que aparezca en el bloque. */
function tagText(block: string, tag: string): string | null {
  const match = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"),
  );
  return match ? match[1] : null;
}

/** Valor de un atributo dentro de la primera etiqueta `tag` del bloque. */
function tagAttr(block: string, tag: string, attribute: string): string | null {
  const re = new RegExp(`<${tag}\\b([^>]*)>`, "gi");
  for (const match of block.matchAll(re)) {
    const attrs = match[1];
    const value = attrs.match(
      new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']*)["']`, "i"),
    );
    if (value) return decodeEntities(value[1].trim());
  }
  return null;
}

/**
 * El link de una entrada Atom. Prioriza `rel="alternate"`; si no hay, toma el
 * primer link que no sea de servicio (self/edit/replies apuntan a la API, no
 * al contenido).
 */
function atomLink(entry: string): string | null {
  const re = /<link\b([^>]*)>/gi;
  let fallback: string | null = null;
  for (const match of entry.matchAll(re)) {
    const attrs = match[1];
    const href = attrs.match(/\bhref\s*=\s*["']([^"']*)["']/i);
    if (!href) continue;
    const rel = attrs.match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1]?.toLowerCase();
    const url = decodeEntities(href[1].trim());
    if (rel === "alternate") return url;
    if (!rel && !fallback) fallback = url;
    if (rel && ["self", "edit", "replies", "hub"].includes(rel)) continue;
    if (!fallback) fallback = url;
  }
  return fallback;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(cleanText(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function firstNonEmpty(...values: (string | null)[]): string {
  for (const value of values) {
    const clean = cleanText(value);
    if (clean) return clean;
  }
  return "";
}

/** Sólo aceptamos http(s): un feed no debería mandarnos a otro esquema. */
export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toItem(
  block: string,
  kind: "rss" | "atom",
): ParsedFeedItem | null {
  const url =
    kind === "atom"
      ? atomLink(block)
      : firstNonEmpty(tagText(block, "link")) || tagAttr(block, "link", "href");

  if (!isSafeHttpUrl(url)) return null;

  const title = firstNonEmpty(tagText(block, "title"));
  if (!title) return null;

  const summary = firstNonEmpty(
    tagText(block, "description"),
    tagText(block, "summary"),
    tagText(block, "content"),
    tagText(block, "media:description"),
  );

  const publishedAt = parseDate(
    tagText(block, "pubDate") ??
      tagText(block, "published") ??
      tagText(block, "updated") ??
      tagText(block, "dc:date"),
  );

  const rawId = firstNonEmpty(tagText(block, "guid"), tagText(block, "id"));

  return {
    externalId: rawId || url!,
    title,
    url: url!,
    summary: summary ? summary.slice(0, 600) : null,
    publishedAt,
  };
}

export function parseFeed(xml: string): ParsedFeed {
  if (!xml || !xml.includes("<")) return { title: null, items: [] };

  const isAtom = /<feed\b[^>]*xmlns\s*=\s*["'][^"']*Atom/i.test(xml) ||
    (/<feed\b/i.test(xml) && /<entry\b/i.test(xml));

  const rawBlocks = isAtom ? blocks(xml, "entry") : blocks(xml, "item");

  // El título del canal es el primer <title> que NO esté dentro de una entrada.
  const head = xml.split(isAtom ? /<entry\b/i : /<item\b/i)[0];
  const title = firstNonEmpty(tagText(head, "title")) || null;

  const items: ParsedFeedItem[] = [];
  const seen = new Set<string>();
  for (const block of rawBlocks) {
    const item = toItem(block, isAtom ? "atom" : "rss");
    if (!item || seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    items.push(item);
  }

  return { title, items };
}

/**
 * Busca el feed declarado por una página HTML
 * (`<link rel="alternate" type="application/rss+xml" href="…">`).
 * Devuelve la URL absoluta, o null si la página no declara ninguno.
 */
export function discoverFeedUrl(html: string, baseUrl: string): string | null {
  const re = /<link\b([^>]*)>/gi;
  for (const match of html.matchAll(re)) {
    const attrs = match[1];
    const rel = attrs.match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1]?.toLowerCase();
    const type = attrs.match(/\btype\s*=\s*["']([^"']*)["']/i)?.[1]?.toLowerCase();
    const href = attrs.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1];
    if (!href || !rel?.includes("alternate")) continue;
    if (!type || !/(rss|atom)\+xml/.test(type)) continue;
    try {
      return new URL(decodeEntities(href.trim()), baseUrl).toString();
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * El channelId de YouTube escondido en el HTML de una página de canal. Con eso
 * se arma el feed oficial, que es público y estable — nada de scraping.
 *
 * El orden importa y no es cosmético: la página de un canal trae PRIMERO los
 * `"channelId"` de los canales recomendados en la barra lateral. Tomar el
 * primero que aparece devuelve el canal equivocado (y un feed que da 404). Las
 * fuentes canónicas —canonical, itemprop, og:url— sí describen a esta página.
 */
const YOUTUBE_ID_PATTERNS: RegExp[] = [
  /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["'][^"']*\/channel\/(UC[\w-]{20,})["']/i,
  /<meta\b[^>]*itemprop\s*=\s*["'](?:identifier|channelId)["'][^>]*content\s*=\s*["'](UC[\w-]{20,})["']/i,
  /<meta\b[^>]*property\s*=\s*["']og:url["'][^>]*content\s*=\s*["'][^"']*\/channel\/(UC[\w-]{20,})["']/i,
  // `externalId` es el del propio canal; `channelId` puede ser de un tercero.
  /"externalId"\s*:\s*"(UC[\w-]{20,})"/,
  /"channelId"\s*:\s*"(UC[\w-]{20,})"/,
];

export function extractYoutubeChannelId(html: string): string | null {
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function youtubeFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}
