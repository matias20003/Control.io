/**
 * Bajar el texto real de una noticia.
 *
 * Sin esto el brief no puede tener calidad, y la razón es concreta: el RSS de
 * Google News trae `<description>`, pero adentro no hay una sola palabra del
 * artículo — es un `<a href>` al propio Google. Verificado sobre el feed en
 * producción. Así que hasta ahora el modelo recibía **únicamente el titular** y
 * le pedíamos "contá qué pasó y por qué importa". Con un titular sólo se puede
 * hacer una cosa: reescribirlo con otras palabras. De ahí que cada resumen
 * sonara a paráfrasis, porque literalmente lo era.
 *
 * Con el cuerpo del artículo el modelo puede citar el dato, el número y el
 * nombre — y, sobre todo, puede darse cuenta de que una nota no dice nada y
 * descartarla.
 */

/** Máximo de texto que se le pasa al modelo por artículo. */
const MAX_CHARS = 4000;
/** Un artículo lento no puede demorar la edición entera. */
const FETCH_TIMEOUT_MS = 6000;
/** Cuántas descargas en paralelo. Suficiente para ir rápido sin parecer un bot. */
const CONCURRENCY = 6;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Bloques que nunca son el artículo. Se sacan antes de mirar los párrafos. */
const NOISE = /<(script|style|noscript|nav|header|footer|aside|form|figure|iframe|svg)\b[\s\S]*?<\/\1>/gi;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/**
 * Saca el texto legible de un HTML.
 *
 * Se queda con los párrafos y no con todo el texto de la página porque el
 * cuerpo de una nota vive en `<p>`; el resto son menús, zócalos y "más
 * noticias", que meterían ruido justo en lo que el modelo va a leer.
 */
export function extractArticleText(html: string): string {
  const clean = html.replace(NOISE, " ");
  const paragraphs = [...clean.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => decodeEntities(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    // Los párrafos muy cortos casi siempre son epígrafes, créditos de foto o
    // "Seguinos en Twitter". El umbral es bajo para no perder frases reales.
    .filter((text) => text.length >= 60);

  const text = paragraphs.join("\n\n");
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text;
}

/**
 * Google News no linkea al medio: linkea a sí mismo y redirige. Cuando el
 * redirect no alcanza, la URL real viene escondida en el HTML de esa página
 * intermedia.
 */
function findRealUrl(html: string): string | null {
  const patterns = [
    /data-n-au="([^"]+)"/,
    /<link\s+rel="canonical"\s+href="([^"]+)"/i,
    /url=(https?:\/\/[^"'&]+)/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && !match[1].includes("news.google.com")) return decodeEntities(match[1]);
  }
  return null;
}

async function fetchHtml(url: string, signal: AbortSignal): Promise<{ html: string; finalUrl: string } | null> {
  const response = await fetch(url, {
    signal,
    redirect: "follow",
    headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9" },
  });
  if (!response.ok) return null;
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("html")) return null;
  return { html: await response.text(), finalUrl: response.url };
}

/**
 * Devuelve el texto del artículo, o null si no se pudo.
 *
 * Null no es un error a esconder: significa "de esta nota no sabemos nada más
 * que el título", y quien decide qué hacer con eso es el filtro de calidad.
 */
export async function fetchArticleText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const first = await fetchHtml(url, controller.signal);
    if (!first) return null;

    // Si el redirect nos dejó igual dentro de Google, buscamos la URL real.
    if (first.finalUrl.includes("news.google.com")) {
      const real = findRealUrl(first.html);
      if (!real) return null;
      const second = await fetchHtml(real, controller.signal);
      if (!second) return null;
      const text = extractArticleText(second.html);
      return text.length >= 200 ? text : null;
    }

    const text = extractArticleText(first.html);
    return text.length >= 200 ? text : null;
  } catch {
    // Timeout, DNS, muro de pago, 403 al bot: se sigue sin el cuerpo.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Baja varios artículos con un tope de descargas simultáneas.
 *
 * Va de a tandas y no todo junto: veinte pedidos a la vez a medios distintos es
 * una forma rápida de que alguno corte la conexión.
 */
export async function fetchArticleTexts(
  urls: string[],
  concurrency = CONCURRENCY,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const queue = [...urls];

  async function worker() {
    for (let url = queue.shift(); url; url = queue.shift()) {
      const text = await fetchArticleText(url);
      if (text) out.set(url, text);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return out;
}
