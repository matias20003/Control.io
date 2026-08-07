import type { RawArticle } from "@/lib/services/news";
import type { MediaCandidate } from "@/lib/services/media-feeds";

/**
 * Une las dos fuentes de noticias en una sola lista para el modelo.
 *
 * Las dos existen porque cada una tapa el agujero de la otra: Google News busca
 * por tema pero entrega el titular pelado, y los feeds de los medios traen
 * resumen de verdad pero no saben qué estás buscando.
 *
 * La diferencia importa tanto que viaja hasta el modelo: cada pieza declara si
 * tiene cuerpo o no. Sin eso, el modelo trata igual a una nota que puede leer y
 * a un título del que no sabe nada, y termina inventando el resumen del
 * segundo — que es exactamente lo que venía pasando.
 */

export type Candidate = RawArticle & {
  /** Hay texto del artículo, no sólo el título. */
  hasBody: boolean;
};

/**
 * Formatos que nunca son noticia, por más que el tema coincida.
 *
 * Se descartan acá y no en el modelo por dos razones: cuestan tokens y son
 * justo el tipo de pieza que un modelo apurado deja pasar. Salieron de mirar
 * qué se colaba de verdad en los feeds — la oferta del celular del día, el
 * listicle de las cinco ciudades, la invitación a una charla.
 */
/**
 * Los límites se escriben a mano con lookarounds Unicode en vez de `\b`.
 * `\b` de JavaScript se define sobre `\w`, que es ASCII: en "Participá" la `á`
 * no cuenta como letra, así que `\bparticipá\b` nunca matchea. En castellano
 * eso deja pasar justo las palabras con tilde.
 */
const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";
const junk = (body: string) => new RegExp(`${B}(?:${body})${E}`, "iu");

const JUNK_PATTERNS: RegExp[] = [
  junk("ofertas?|descuentos?|rebajas?|chollos?|cupón|black friday|cyber monday"),
  junk("cae de precio|precio mínimo|más barato que nunca|a mitad de precio|liquidación"),
  // "Las 5 ciudades más…", "Los 7 mejores…", esté al principio o en el medio.
  // El lookahead evita comerse frases legítimas donde el número es una
  // magnitud y no un conteo de ítems: "los 30 años", "los 500 millones".
  junk("(?:los|las)\\s+\\d{1,2}\\s+(?!años|anos|meses|días|dias|horas|semanas|millones|mil|puntos|pesos|dólares|dolares)\\p{L}{3,}"),
  junk("\\d+\\s+(?:mejores|claves|trucos|consejos|razones|formas|maneras|cosas)"),
  junk("horóscopo|zodíaco|signos del zodiaco|lotería|quiniela|resultados del sorteo"),
  junk("participá|participa|inscribite|inscribíte|sorteo|webinar|se realizará el|invita a la charla"),
  junk("en vivo|minuto a minuto|seguí acá|así fue el|las mejores fotos|las imágenes de"),
];

/** ¿Es un formato que no aporta un hecho, sin importar de qué tema hable? */
export function isJunk(title: string): boolean {
  return JUNK_PATTERNS.some((pattern) => pattern.test(title));
}

/** ¿El título habla de alguno de los temas? Grosero a propósito: filtra, no juzga. */
function matchesTopic(title: string, summary: string | null, topics: string[]): string | null {
  const haystack = `${title} ${summary ?? ""}`.toLowerCase();
  let best: { topic: string; hits: number } | null = null;

  for (const topic of topics) {
    // Se parte el tema en palabras con peso. Las cortas ("de", "la", "para")
    // hacen que cualquier nota matchee con cualquier tema.
    const words = topic
      .toLowerCase()
      .replace(/[.,;:!?()]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 5);
    if (words.length === 0) continue;
    const hits = words.filter((word) => haystack.includes(word)).length;
    // Con una sola palabra en común no alcanza cuando el tema tiene varias:
    // "clientes" no convierte cualquier nota en una sobre captación de clientes.
    const needed = words.length >= 3 ? 2 : 1;
    if (hits >= needed && (!best || hits > best.hits)) best = { topic, hits };
  }
  return best?.topic ?? null;
}

/**
 * Convierte los candidatos de feeds en el formato común, quedándose sólo con
 * los que hablan de algún tema del usuario. Un feed trae la portada entera del
 * medio: sin este filtro, el brief se llenaría de política y fútbol.
 */
export function fromMedia(
  media: MediaCandidate[],
  topics: string[],
  isReputable: (source: string) => boolean,
): Candidate[] {
  const out: Candidate[] = [];
  for (const item of media) {
    if (isJunk(item.title)) continue;
    const topic = matchesTopic(item.title, item.summary, topics);
    if (!topic) continue;
    const summary = (item.summary ?? "").trim();
    out.push({
      title: item.title,
      url: item.url,
      source: item.source,
      sourceUrl: null,
      topic,
      publishedAt: item.publishedAt,
      snippet: summary.slice(0, 1200),
      priority: false,
      reputable: isReputable(item.source),
      // Un resumen de dos líneas ya es más de lo que da un titular, pero recién
      // desde unos 180 caracteres hay algo que el modelo pueda citar.
      hasBody: summary.length >= 180,
    });
  }
  return out;
}

/**
 * Junta las dos fuentes sin repetir la misma nota.
 *
 * Cuando un hecho aparece en las dos, gana la versión con cuerpo: es la misma
 * noticia, pero de una se puede escribir algo y de la otra no.
 */
export function mergeCandidates(
  news: RawArticle[],
  media: MediaCandidate[],
  topics: string[],
  isReputable: (source: string) => boolean,
): Candidate[] {
  const fromNews: Candidate[] = news
    .filter((article) => !isJunk(article.title))
    .map((article) => ({
      ...article,
      // Google News no entrega cuerpo: su `description` es un enlace a sí mismo.
      hasBody: false,
    }));

  const byTitle = new Map<string, Candidate>();
  const key = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

  // Primero los que tienen cuerpo, así ganan el lugar en caso de repetido.
  for (const candidate of [...fromMedia(media, topics, isReputable), ...fromNews]) {
    const id = key(candidate.title);
    if (!id || byTitle.has(id)) continue;
    byTitle.set(id, candidate);
  }

  // Con cuerpo arriba: si la lista se corta por límite de tamaño, lo que se
  // pierde tiene que ser lo que menos aporta.
  return [...byTitle.values()].sort((a, b) => Number(b.hasBody) - Number(a.hasBody));
}
