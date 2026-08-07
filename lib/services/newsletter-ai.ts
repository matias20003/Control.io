// Análisis de noticias con IA vía OpenRouter (modelo gratuito).
// Selecciona las 3 noticias MÁS RELEVANTES por cada tema del usuario.
// Si no hay OPENROUTER_API_KEY, cae a un ranking heurístico (por fecha).

import type { RawArticle } from "./news";

export type AnalyzedArticle = {
  title: string;
  url: string;
  source: string;
  sourceUrl?: string | null;
  topic: string;
  publishedAt: string | null;
  summary: string; // resumen de 1 línea
  rank: number; // 1..3 dentro de su tema (1 = la más relevante)
  highlight: boolean; // la #1 de su tema (compat / énfasis visual)
  priority: boolean; // el tema es prioritario para el usuario
  reputable: boolean; // la fuente es un medio reconocido/confiable
};

export type NewsletterAnalysis = {
  summary: string; // análisis general del día (2-4 frases)
  articles: AnalyzedArticle[]; // agrupables por tema, máx 3 por tema
  usedAI: boolean;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Cuántas noticias mostramos por cada tema.
const PER_TOPIC = 3;

// Cadena de modelos: se prueban en orden hasta que uno responda.
// Primero modelos PAGOS de OpenRouter (rápidos ~2-3s, confiables, baratísimos:
// fracciones de centavo por edición) y de respaldo los ":free" por si se acaba
// el crédito. Se puede overridear con la env var OPENROUTER_MODEL.
const MODELS = (
  process.env.OPENROUTER_MODEL ??
  "google/gemini-2.5-flash,google/gemini-2.5-flash-lite,openai/gpt-4o-mini,meta-llama/llama-3.3-70b-instruct:free,openai/gpt-oss-20b:free"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

// Presupuesto TOTAL de la IA. NO podemos esperar a todos los modelos free
// lentos (rondan 15-40s c/u); si nadie respondió dentro del presupuesto,
// devolvemos el ranking heurístico sin colgar la función. El presupuesto es
// parametrizable: "Generar ahora" es sincrónico (página maxDuration=60) → corto;
// el cron diario corre en background (maxDuration=300) → puede ser generoso.
const DEFAULT_AI_DEADLINE_MS = 45000;
const MAX_PER_MODEL_MS = 40000;

function stripJson(text: string): string {
  let t = text.trim();
  // quita fences ```json ... ```
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // recorta al primer { y último }
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return t;
}

/** Ordena los temas poniendo los prioritarios primero (conserva el orden relativo). */
function orderTopics(topics: string[], priorityTopics: string[]): string[] {
  const prio = new Set(priorityTopics.map((t) => t.toLowerCase()));
  return [...topics].sort((a, b) => {
    const pa = prio.has(a.toLowerCase()) ? 0 : 1;
    const pb = prio.has(b.toLowerCase()) ? 0 : 1;
    return pa - pb;
  });
}

function byDateDesc(a: RawArticle, b: RawArticle): number {
  const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
  const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
  return tb - ta;
}

/**
 * Fallback sin IA: agrupa por tema, ordena por fecha y toma las 3 más recientes
 * de cada uno. Temas prioritarios primero.
 */
function heuristicAnalysis(
  topics: string[],
  articles: RawArticle[],
  priorityTopics: string[]
): NewsletterAnalysis {
  const ordered = orderTopics(topics, priorityTopics);
  const analyzed: AnalyzedArticle[] = [];

  for (const topic of ordered) {
    const forTopic = articles
      .filter((a) => a.topic === topic)
      // Sin IA no podemos juzgar veracidad, pero sí preferir fuentes
      // reconocidas: van primero, luego por fecha.
      .sort((a, b) => {
        if (a.reputable !== b.reputable) return a.reputable ? -1 : 1;
        return byDateDesc(a, b);
      })
      .slice(0, PER_TOPIC);

    forTopic.forEach((a, i) => {
      analyzed.push({
        title: a.title,
        url: a.url,
        source: a.source,
        sourceUrl: a.sourceUrl,
        topic: a.topic,
        publishedAt: a.publishedAt,
        summary: a.snippet || "",
        rank: i + 1,
        highlight: i === 0,
        priority: a.priority,
        reputable: a.reputable,
      });
    });
  }

  const summary =
    analyzed.length > 0
      ? `Estas son las noticias más recientes de tus temas (${topics.join(", ")}). Activá el análisis con IA para un resumen priorizado y mejor filtrado.`
      : `No encontramos noticias nuevas sobre ${topics.join(", ")} hoy.`;

  return { summary, articles: analyzed, usedAI: false };
}

/** A partir de los items elegidos por la IA, arma máx 3 por tema (prioritarios primero). */
function buildFromAiItems(
  topics: string[],
  priorityTopics: string[],
  articles: RawArticle[],
  items: { id: number; summary?: string; rank?: number }[]
): AnalyzedArticle[] {
  // Mejor item por id (por si la IA repite).
  const byId = new Map<number, { summary?: string; rank?: number }>();
  for (const it of items) {
    if (typeof it.id === "number" && articles[it.id]) byId.set(it.id, it);
  }

  const ordered = orderTopics(topics, priorityTopics);
  const analyzed: AnalyzedArticle[] = [];

  for (const topic of ordered) {
    // ids que pertenecen a este tema y que la IA conservó.
    const picked = [...byId.entries()]
      .filter(([id]) => articles[id].topic === topic)
      .map(([id, it]) => ({ id, it }))
      .sort((a, b) => {
        const ra = a.it.rank ?? 99;
        const rb = b.it.rank ?? 99;
        if (ra !== rb) return ra - rb;
        return byDateDesc(articles[a.id], articles[b.id]);
      })
      .slice(0, PER_TOPIC);

    picked.forEach(({ id, it }, i) => {
      const a = articles[id];
      analyzed.push({
        title: a.title,
        url: a.url,
        source: a.source,
        sourceUrl: a.sourceUrl,
        topic: a.topic,
        publishedAt: a.publishedAt,
        summary: it.summary?.trim() || a.snippet || "",
        rank: i + 1,
        highlight: i === 0,
        priority: a.priority,
        reputable: a.reputable,
      });
    });
  }

  return analyzed;
}

type Provider = { url: string; key: string; models: string[]; extraHeaders: Record<string, string> };

// Preferimos la Gemini API de Google (gratis, endpoint compatible con OpenAI).
// Si no hay GEMINI_API_KEY, caemos a OpenRouter (que puede estar sin crédito).
function aiProvider(): Provider | null {
  const gem = process.env.GEMINI_API_KEY;
  if (gem) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: gem,
      // flash-latest primario (mejor criterio editorial; el newsletter corre
      // 1 vez/día por usuario, así que su cupo alcanza). flash-lite-latest de
      // respaldo por si flash-latest está saturado (429) → no cae a heurístico.
      models: [
        process.env.NEWSLETTER_MODEL_GEMINI ?? "gemini-flash-latest",
        "gemini-flash-lite-latest",
      ],
      extraHeaders: {},
    };
  }
  const or = process.env.OPENROUTER_API_KEY;
  if (or) {
    return {
      url: OPENROUTER_URL,
      key: or,
      models: MODELS,
      extraHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://control.io",
        "X-Title": "control.io newsletter",
      },
    };
  }
  return null;
}

export async function analyzeNews(
  topics: string[],
  articles: RawArticle[],
  priorityTopics: string[] = [],
  deadlineMs: number = DEFAULT_AI_DEADLINE_MS
): Promise<NewsletterAnalysis> {
  const provider = aiProvider();

  if (!provider || articles.length === 0) {
    return heuristicAnalysis(topics, articles, priorityTopics);
  }

  // Limitamos lo que mandamos al modelo.
  const input = articles.slice(0, 50).map((a, i) => ({
    id: i,
    title: a.title,
    source: a.source,
    reputable: a.reputable, // fuente reconocida (señal de confianza)
    topic: a.topic,
    priority: a.priority,
    // Lo que se sabe del artículo además del título. Cuando viene de Google
    // News no hay nada: su feed no entrega una palabra del cuerpo.
    contenido: a.snippet?.trim() || null,
    tieneContenido: Boolean((a as { hasBody?: boolean }).hasBody),
    publishedAt: a.publishedAt,
  }));

  const priorityLine =
    priorityTopics.length > 0
      ? `\nEl usuario marcó como PRIORITARIOS estos temas: ${priorityTopics.join(", ")}. Mencionálos primero en el análisis general.`
      : "";

  const system = `Sos el editor de un brief diario para UNA persona. El lector sigue estos temas: ${topics.join(", ")}.${priorityLine}
Recibís candidatos del día. Cada uno trae "title", "source", "reputable", "topic", "contenido" y "tieneContenido".

LA REGLA QUE MANDA SOBRE TODAS: si no podés decir algo concreto sobre una noticia, NO LA INCLUYAS.
- Con "tieneContenido": false sólo tenés el titular. NO inventes qué dice la nota ni la parafrasees: incluila SÓLO si el propio titular ya trae el hecho completo (un número, una decisión, un nombre). Si el titular es del tipo "cuáles son las claves", "todo lo que hay que saber", "cómo funciona" o "los 5 mejores", DESCARTALA: no sabés qué dice adentro.
- Con "tieneContenido": true leé el "contenido" y escribí desde ahí, no desde el título.

CALIDAD (esto es un brief para alguien que decide algo, no una portada):
- Preferí lo que cambia una decisión: cifras, medidas, lanzamientos, fallos, cambios de regla, resultados.
- DESCARTÁ SIEMPRE: listicles ("las 5 ciudades…", "las carreras más demandadas"), rankings promocionales, notas de agenda ("participá de la charla"), efemérides, horóscopos, contenido patrocinado, y todo lo que sea consejo genérico sin hecho nuevo.
- DESCARTÁ clickbait, sensacionalismo, rumores sin confirmar y teorías conspirativas. Ante la duda sobre la veracidad, descartá.
- Preferí fuentes con "reputable": true y hechos que aparezcan en más de una fuente.
- Un tema puede quedarse con CERO noticias. Es un resultado válido y frecuente: la mayoría de los días no pasa nada relevante sobre un tema de nicho. Devolver dos piezas buenas es mejor que seis de relleno.

RELEVANCIA: cada tema es una intención completa, no una bolsa de palabras. "Captación de clientes para constructoras" NO se cumple con una nota sobre el mercado inmobiliario en general. Que coincida una palabra no alcanza.

CÓMO ESCRIBIR CADA RESUMEN (una sola línea, español rioplatense neutro):
- Tiene que contener AL MENOS UN DATO DURO: una cifra, una fecha, un nombre propio, una magnitud.
- PROHIBIDO reescribir el título con sinónimos. Si tu resumen dice lo mismo que el título, la noticia no aporta: descartala.
- Nada de fórmulas vacías ("destaca la importancia de", "se analizan las claves", "busca dinamizar").

Tu tarea:
1. "summary": 2 a 4 frases con lo importante y verificado del día, empezando por lo prioritario. Si el día es flojo, decilo en una frase — no lo infles. Sin sensacionalismo ni relleno.
2. Elegí hasta 3 noticias por tema, rankeadas ("rank" 1 = la más relevante). Menos es mejor que peor.
3. Para cada elegida devolvé su id, su "summary" de una línea con dato duro, y su "rank".
Respondé SOLO con JSON válido, sin texto extra, con esta forma exacta:
{"summary":"...","items":[{"id":0,"summary":"...","rank":1}]}`;

  const user = `Noticias de hoy:\n${JSON.stringify(input)}`;

  // Probamos los modelos en orden, acotados a un presupuesto total de tiempo.
  const start = Date.now();
  for (const model of provider.models) {
    const remaining = deadlineMs - (Date.now() - start);
    if (remaining < 5000) break; // sin margen para otra llamada útil

    const parsed = await callModel(
      provider,
      model,
      system,
      user,
      Math.min(MAX_PER_MODEL_MS, remaining)
    );
    if (!parsed?.items) continue;

    const analyzed = buildFromAiItems(
      topics,
      priorityTopics,
      articles,
      parsed.items
    );
    if (analyzed.length === 0) continue;

    return {
      summary:
        parsed.summary?.trim() ||
        heuristicAnalysis(topics, articles, priorityTopics).summary,
      articles: analyzed,
      usedAI: true,
    };
  }

  // Ningún modelo respondió dentro del presupuesto → ranking heurístico.
  return heuristicAnalysis(topics, articles, priorityTopics);
}

type AiParsed = {
  summary?: string;
  items?: { id: number; summary?: string; rank?: number }[];
};

/** Una llamada a un modelo. Devuelve el JSON parseado o null si falla. */
async function callModel(
  provider: Provider,
  model: string,
  system: string,
  user: string,
  timeoutMs: number
): Promise<AiParsed | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(provider.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
        ...provider.extraHeaders,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 2500,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    // 429 (rate limit) / 404 (modelo caído) → probamos el siguiente.
    if (!res.ok) return null;

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(stripJson(content)) as AiParsed;
    if (!parsed.items || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    // JSON inválido, timeout (abort) o error de red → siguiente modelo.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
