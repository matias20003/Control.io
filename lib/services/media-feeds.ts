import { parseFeed } from "@/lib/brief/feed-parser";

/**
 * Feeds propios de los medios, como fuente de piezas con contenido.
 *
 * Existe por un hallazgo concreto: el RSS de Google News trae `<description>`,
 * pero adentro no hay una palabra del artículo — es un `<a href>` al propio
 * Google. Y desde 2024 sus enlaces son identificadores opacos que llevan a una
 * página de JavaScript, así que tampoco se puede ir a buscar el texto. O sea
 * que por Google News el modelo recibe **el titular y nada más**, y con un
 * titular sólo se puede escribir una cosa: el mismo titular con otras palabras.
 *
 * Los feeds de los medios, en cambio, traen resumen de verdad —de 150 a 8.000
 * caracteres según el medio— y el enlace directo a la nota, del que sí se puede
 * sacar el cuerpo completo. Todos los de esta lista fueron probados uno por uno
 * contra su servidor: los que devolvían 404 o venían vacíos quedaron afuera.
 *
 * Google News se sigue usando en paralelo, porque busca por tema y esto no:
 * un feed trae lo que el medio publicó, no lo que vos buscabas.
 */

export type MediaFeed = {
  id: string;
  /** Nombre del medio, tal como se le muestra al lector. */
  source: string;
  url: string;
  /** Para elegir qué feeds traer según los temas del usuario. */
  tags: FeedTag[];
  /** Medio argentino: para un lector de acá, lo local pesa más. */
  local: boolean;
};

export type FeedTag = "general" | "economia" | "negocios" | "tecnologia" | "ia";

export const MEDIA_FEEDS: MediaFeed[] = [
  // ── Argentina ──
  { id: "infobae", source: "Infobae", url: "https://www.infobae.com/arc/outboundfeeds/rss/?outputType=xml", tags: ["general"], local: true },
  { id: "infobae-econ", source: "Infobae", url: "https://www.infobae.com/arc/outboundfeeds/rss/category/economia/?outputType=xml", tags: ["economia"], local: true },
  { id: "infobae-tecno", source: "Infobae", url: "https://www.infobae.com/arc/outboundfeeds/rss/category/tecno/?outputType=xml", tags: ["tecnologia", "ia"], local: true },
  { id: "lanacion-econ", source: "La Nación", url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/?outputType=xml", tags: ["economia"], local: true },
  { id: "lanacion-tecno", source: "La Nación", url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/tecnologia/?outputType=xml", tags: ["tecnologia", "ia"], local: true },
  { id: "clarin-econ", source: "Clarín", url: "https://www.clarin.com/rss/economia/", tags: ["economia"], local: true },
  { id: "clarin-tecno", source: "Clarín", url: "https://www.clarin.com/rss/tecnologia/", tags: ["tecnologia", "ia"], local: true },
  { id: "cronista-negocios", source: "El Cronista", url: "https://www.cronista.com/files/rss/negocios.xml", tags: ["negocios", "economia"], local: true },
  { id: "cronista", source: "El Cronista", url: "https://www.cronista.com/files/rss/news.xml", tags: ["general", "economia"], local: true },
  { id: "ambito-negocios", source: "Ámbito", url: "https://www.ambito.com/rss/pages/negocios.xml", tags: ["negocios", "economia"], local: true },
  { id: "ambito-tecno", source: "Ámbito", url: "https://www.ambito.com/rss/pages/tecnologia.xml", tags: ["tecnologia"], local: true },
  { id: "iprofesional", source: "iProfesional", url: "https://www.iprofesional.com/rss/negocios", tags: ["negocios", "economia"], local: true },
  { id: "perfil-tecno", source: "Perfil", url: "https://www.perfil.com/feed/tecnologia", tags: ["tecnologia"], local: true },

  // ── Tecnología en español, fuera de Argentina ──
  { id: "xataka", source: "Xataka", url: "https://www.xataka.com/feedburner.xml", tags: ["tecnologia", "ia"], local: false },
  { id: "genbeta", source: "Genbeta", url: "https://www.genbeta.com/feedburner.xml", tags: ["tecnologia"], local: false },
  { id: "hipertextual", source: "Hipertextual", url: "https://hipertextual.com/feed", tags: ["tecnologia", "ia"], local: false },
  { id: "wired-es", source: "WIRED", url: "https://es.wired.com/feed/rss", tags: ["tecnologia", "ia"], local: false },
  { id: "mit-ai", source: "MIT Technology Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", tags: ["ia"], local: false },
];

/** Palabras que delatan de qué habla un tema, para elegir feeds. */
const TAG_HINTS: Record<Exclude<FeedTag, "general">, string[]> = {
  ia: ["inteligencia artificial", " ia ", "machine learning", "modelo", "chatgpt", "openai", "llm", "algoritmo"],
  tecnologia: ["tecnolog", "software", "sistemas", "programaci", "desarrollo web", "informát", "startup", "app", "digital", "ingenier"],
  economia: ["econom", "inflaci", "dólar", "dolar", "finanz", "inversi", "mercado", "banco", "tasa", "precio"],
  negocios: ["negocio", "cliente", "venta", "marketing", "empresa", "emprend", "b2b", "comercial", "inmobiliar", "constructor"],
};

/**
 * Qué feeds traer para estos temas.
 *
 * Siempre entra algo general: si los temas son muy de nicho y ningún tag pega,
 * quedarse sin candidatos sería peor que ofrecer lo del día y dejar que el
 * filtro decida.
 */
export function feedsForTopics(topics: string[], limit = 10): MediaFeed[] {
  const haystack = ` ${topics.join(" ").toLowerCase()} `;
  const wanted = new Set<FeedTag>(["general"]);
  for (const [tag, hints] of Object.entries(TAG_HINTS)) {
    if (hints.some((hint) => haystack.includes(hint))) wanted.add(tag as FeedTag);
  }

  const matches = MEDIA_FEEDS.filter((feed) => feed.tags.some((tag) => wanted.has(tag)));
  // Los locales primero: para un lector argentino, lo de acá pesa más que una
  // nota igual de buena publicada a diez mil kilómetros.
  return matches
    .sort((a, b) => Number(b.local) - Number(a.local))
    .slice(0, limit);
}

export type MediaCandidate = {
  title: string;
  url: string;
  source: string;
  /** Resumen del propio medio. Acá sí hay contenido, a diferencia de Google News. */
  summary: string | null;
  publishedAt: string | null;
  local: boolean;
};

const FETCH_TIMEOUT_MS = 8000;
const UA = "Mozilla/5.0 (compatible; control.io-brief/1.0; +https://controlio.site)";

async function fetchFeed(feed: MediaFeed, sinceHours: number, perFeed: number): Promise<MediaCandidate[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": UA },
      next: { revalidate: 1800 },
    });
    if (!response.ok) return [];
    const parsed = parseFeed(await response.text());
    const cutoff = Date.now() - sinceHours * 3_600_000;

    return parsed.items
      // Una nota de la semana pasada en un brief diario es relleno. Las que no
      // declaran fecha se dejan pasar: no tener fecha no las hace viejas.
      .filter((item) => !item.publishedAt || item.publishedAt.getTime() >= cutoff)
      .slice(0, perFeed)
      .map((item) => ({
        title: item.title,
        url: item.url,
        source: feed.source,
        summary: item.summary,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        local: feed.local,
      }));
  } catch {
    // Un medio caído no puede tumbar la edición.
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Trae candidatos de los medios que correspondan a los temas.
 *
 * Deduplica por URL y por título: los mismos cables aparecen en varios feeds
 * del mismo grupo editorial, y contarlos dos veces le haría creer al modelo que
 * un hecho está más corroborado de lo que está.
 */
export async function fetchMediaCandidates(
  topics: string[],
  opts: { sinceHours?: number; perFeed?: number; maxFeeds?: number } = {},
): Promise<MediaCandidate[]> {
  const feeds = feedsForTopics(topics, opts.maxFeeds ?? 10);
  const lists = await Promise.all(
    feeds.map((feed) => fetchFeed(feed, opts.sinceHours ?? 36, opts.perFeed ?? 12)),
  );

  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const out: MediaCandidate[] = [];
  for (const list of lists) {
    for (const candidate of list) {
      const titleKey = candidate.title.toLowerCase().replace(/\s+/g, " ").trim();
      if (seenUrl.has(candidate.url) || seenTitle.has(titleKey)) continue;
      seenUrl.add(candidate.url);
      seenTitle.add(titleKey);
      out.push(candidate);
    }
  }
  return out;
}
