/**
 * Mi Círculo · Referentes por obra — resolución y lectura de canales.
 *
 * Al agregar un referente no se pide su `@`: se pregunta dónde publica lo que
 * sirve. Esto toma esa URL y encuentra su feed abierto (RSS, Atom, YouTube,
 * podcast). Lo que no tiene feed propio queda marcado como huérfano y es el
 * único candidato al puente. Ver docs/MI_CIRCULO.md.
 *
 * Nada de scraping: sólo feeds que la propia plataforma publica.
 */

import {
  discoverFeedUrl,
  extractYoutubeChannelId,
  isSafeHttpUrl,
  parseFeed,
  youtubeFeedUrl,
  type ParsedFeedItem,
} from "@/lib/brief/feed-parser";

export type ChannelKind = "RSS" | "YOUTUBE" | "PODCAST" | "NEWSLETTER" | "WEB";

export type ResolvedChannel = {
  kind: ChannelKind;
  siteUrl: string;
  feedUrl: string;
  title: string | null;
};

export type ChannelResolution =
  | { ok: true; channel: ResolvedChannel }
  | { ok: false; orphan: boolean; reason: string };

const TIMEOUT_MS = 8000;
const MAX_BYTES = 2_000_000;
const USER_AGENT = "Control.io/1.0 (+https://controlio.site)";

/** Plataformas cerradas: no publican un feed que podamos leer legítimamente. */
const SIN_CANAL_PROPIO = new Set([
  "instagram.com",
  "www.instagram.com",
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "tiktok.com",
  "www.tiktok.com",
  "facebook.com",
  "www.facebook.com",
  "threads.net",
  "www.threads.net",
]);

/** Rutas que la mayoría de los blogs y CMS usan cuando no declaran el feed. */
const RUTAS_HABITUALES = [
  "/feed",
  "/rss",
  "/feed.xml",
  "/rss.xml",
  "/atom.xml",
  "/index.xml",
  "/feed/",
];

/**
 * Corta el SSRF: el server va a buscar una URL que escribió el usuario, así que
 * no puede terminar pegándole a la red interna. Bloquea localhost, rangos
 * privados y direcciones de metadatos de la nube.
 */
export function isPublicHttpUrl(value: string): boolean {
  if (!isSafeHttpUrl(value)) return false;
  let host: string;
  try {
    host = new URL(value).hostname.toLowerCase();
  } catch {
    return false;
  }

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return false;
  }

  // IPv6: sólo se aceptan direcciones que no sean de loopback ni link-local.
  if (host.startsWith("[")) {
    const inner = host.slice(1, -1);
    return !(inner === "::1" || inner.startsWith("fe80") || inner.startsWith("fc") || inner.startsWith("fd"));
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 10 || a === 0) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false; // metadatos de la nube
  }

  return true;
}

/** Lo que escribe una persona no siempre es una URL. Esto lo acomoda. */
export function normalizeInputUrl(raw: string): string | null {
  const clean = raw.trim();
  if (!clean) return null;
  const withScheme = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

type FetchedText = { text: string; contentType: string; finalUrl: string };

async function fetchText(url: string): Promise<FetchedText | null> {
  if (!isPublicHttpUrl(url)) return null;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8",
      },
    });
    if (!response.ok) return null;

    // Una respuesta gigante no puede comerse la memoria del server.
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared && declared > MAX_BYTES) return null;

    const text = (await response.text()).slice(0, MAX_BYTES);
    return {
      text,
      contentType: (response.headers.get("content-type") ?? "").toLowerCase(),
      finalUrl: response.url || url,
    };
  } catch {
    // Timeout, DNS, TLS, red caída: el referente queda sin canal, no rompe nada.
    return null;
  }
}

function looksLikeFeed(body: FetchedText): boolean {
  if (/(rss|atom)\+xml|text\/xml|application\/xml/.test(body.contentType)) return true;
  const head = body.text.slice(0, 500).toLowerCase();
  return head.includes("<rss") || head.includes("<feed") || head.includes("<?xml");
}

function kindForUrl(feedUrl: string, siteUrl: string): ChannelKind {
  const host = new URL(siteUrl).hostname.toLowerCase();
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "YOUTUBE";
  if (
    host.includes("podcast") ||
    host.includes("spotify") ||
    host.includes("ivoox") ||
    feedUrl.includes("podcast")
  ) {
    return "PODCAST";
  }
  if (host.includes("substack.com") || host.includes("beehiiv.com") || host.includes("ghost.io")) {
    return "NEWSLETTER";
  }
  return "RSS";
}

/** Podcasts de Apple: la API pública de búsqueda devuelve el RSS original. */
async function resolveApplePodcast(url: URL): Promise<ResolvedChannel | null> {
  const id = url.pathname.match(/\/id(\d+)/)?.[1] ?? url.searchParams.get("i");
  if (!id) return null;
  const lookup = await fetchText(`https://itunes.apple.com/lookup?id=${id}&entity=podcast`);
  if (!lookup) return null;
  try {
    const data = JSON.parse(lookup.text);
    const feedUrl = data?.results?.[0]?.feedUrl;
    const title = data?.results?.[0]?.collectionName ?? null;
    if (typeof feedUrl === "string" && isPublicHttpUrl(feedUrl)) {
      return { kind: "PODCAST", siteUrl: url.toString(), feedUrl, title };
    }
  } catch {
    // Respuesta inesperada: se sigue por los otros caminos.
  }
  return null;
}

async function resolveYoutube(url: URL): Promise<ResolvedChannel | null> {
  // Si ya es el feed, no hay nada que resolver.
  if (url.pathname.includes("/feeds/videos.xml")) {
    return { kind: "YOUTUBE", siteUrl: url.toString(), feedUrl: url.toString(), title: null };
  }
  const directId = url.pathname.match(/\/channel\/(UC[\w-]{20,})/)?.[1];
  if (directId) {
    return {
      kind: "YOUTUBE",
      siteUrl: url.toString(),
      feedUrl: youtubeFeedUrl(directId),
      title: null,
    };
  }
  const page = await fetchText(url.toString());
  if (!page) return null;
  const channelId = extractYoutubeChannelId(page.text);
  if (!channelId) return null;
  return {
    kind: "YOUTUBE",
    siteUrl: url.toString(),
    feedUrl: youtubeFeedUrl(channelId),
    title: null,
  };
}

/**
 * Dada la URL donde alguien publica, encuentra su feed.
 *
 * Devolver `orphan: true` no es un error: significa que ese referente sólo vive
 * en una plataforma cerrada. Es información honesta y es lo que después alimenta
 * el contador del puente.
 */
export async function resolveChannel(input: string): Promise<ChannelResolution> {
  const normalized = normalizeInputUrl(input);
  if (!normalized) {
    return { ok: false, orphan: false, reason: "Eso no parece una dirección web." };
  }
  if (!isPublicHttpUrl(normalized)) {
    return { ok: false, orphan: false, reason: "Esa dirección no es pública." };
  }

  const url = new URL(normalized);
  const host = url.hostname.toLowerCase();

  if (SIN_CANAL_PROPIO.has(host)) {
    return {
      ok: false,
      orphan: true,
      reason: "Esa plataforma no publica un canal abierto que podamos leer.",
    };
  }

  if (host.includes("youtube.com") || host.includes("youtu.be")) {
    const channel = await resolveYoutube(url);
    if (channel) return { ok: true, channel: await withTitle(channel) };
    return { ok: false, orphan: true, reason: "No pudimos identificar ese canal de YouTube." };
  }

  if (host.includes("podcasts.apple.com") || host.includes("itunes.apple.com")) {
    const channel = await resolveApplePodcast(url);
    if (channel) return { ok: true, channel };
    return { ok: false, orphan: true, reason: "No pudimos encontrar el feed de ese podcast." };
  }

  // ¿La URL ya es el feed?
  const direct = await fetchText(normalized);
  if (direct && looksLikeFeed(direct)) {
    const parsed = parseFeed(direct.text);
    if (parsed.items.length > 0) {
      return {
        ok: true,
        channel: {
          kind: kindForUrl(normalized, normalized),
          siteUrl: normalized,
          feedUrl: direct.finalUrl,
          title: parsed.title,
        },
      };
    }
  }

  // ¿La página declara su feed?
  if (direct) {
    const declared = discoverFeedUrl(direct.text, direct.finalUrl);
    if (declared && isPublicHttpUrl(declared)) {
      const feed = await fetchText(declared);
      if (feed && looksLikeFeed(feed)) {
        const parsed = parseFeed(feed.text);
        return {
          ok: true,
          channel: {
            kind: kindForUrl(declared, normalized),
            siteUrl: normalized,
            feedUrl: declared,
            title: parsed.title,
          },
        };
      }
    }
  }

  // Último intento: las rutas que usa casi todo el mundo.
  for (const path of RUTAS_HABITUALES) {
    const candidate = new URL(path, url.origin).toString();
    const feed = await fetchText(candidate);
    if (!feed || !looksLikeFeed(feed)) continue;
    const parsed = parseFeed(feed.text);
    if (parsed.items.length === 0) continue;
    return {
      ok: true,
      channel: {
        kind: kindForUrl(candidate, normalized),
        siteUrl: normalized,
        feedUrl: candidate,
        title: parsed.title,
      },
    };
  }

  return {
    ok: false,
    orphan: true,
    reason: "No encontramos un canal abierto en esa dirección.",
  };
}

/** Completa el título leyendo el feed, cuando la resolución no lo trajo. */
async function withTitle(channel: ResolvedChannel): Promise<ResolvedChannel> {
  if (channel.title) return channel;
  const feed = await fetchText(channel.feedUrl);
  if (!feed) return channel;
  return { ...channel, title: parseFeed(feed.text).title };
}

export type ChannelFetch =
  | { ok: true; items: ParsedFeedItem[]; title: string | null }
  | { ok: false; error: string };

/** Lee las últimas publicaciones de un canal ya resuelto. */
export async function fetchChannelItems(
  feedUrl: string,
  limit = 5,
): Promise<ChannelFetch> {
  const body = await fetchText(feedUrl);
  if (!body) return { ok: false, error: "No pudimos leer el canal." };
  if (!looksLikeFeed(body)) return { ok: false, error: "Eso ya no devuelve un feed." };

  const parsed = parseFeed(body.text);
  const items = [...parsed.items]
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, limit);

  return { ok: true, items, title: parsed.title };
}
