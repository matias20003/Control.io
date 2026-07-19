// Análisis de noticias con IA vía OpenRouter (modelo gratuito).
// Selecciona las 3 noticias MÁS RELEVANTES por cada tema del usuario.
// Si no hay OPENROUTER_API_KEY, cae a un ranking heurístico (por fecha).

import type { RawArticle } from "./news";

export type AnalyzedArticle = {
  title: string;
  url: string;
  source: string;
  topic: string;
  publishedAt: string | null;
  summary: string; // resumen de 1 línea
  rank: number; // 1..3 dentro de su tema (1 = la más relevante)
  highlight: boolean; // la #1 de su tema (compat / énfasis visual)
  priority: boolean; // el tema es prioritario para el usuario
};

export type NewsletterAnalysis = {
  summary: string; // análisis general del día (2-4 frases)
  articles: AnalyzedArticle[]; // agrupables por tema, máx 3 por tema
  usedAI: boolean;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Cuántas noticias mostramos por cada tema.
const PER_TOPIC = 3;

// Cadena de modelos gratuitos: se prueban en orden hasta que uno responda.
// Los ":free" se rate-limitean (429) seguido, por eso hay varios de respaldo.
const MODELS = (
  process.env.OPENROUTER_MODEL ??
  "openai/gpt-oss-20b:free,meta-llama/llama-3.3-70b-instruct:free,qwen/qwen3-next-80b-a3b-instruct:free"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

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
      .sort(byDateDesc)
      .slice(0, PER_TOPIC);

    forTopic.forEach((a, i) => {
      analyzed.push({
        title: a.title,
        url: a.url,
        source: a.source,
        topic: a.topic,
        publishedAt: a.publishedAt,
        summary: a.snippet || "",
        rank: i + 1,
        highlight: i === 0,
        priority: a.priority,
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
        topic: a.topic,
        publishedAt: a.publishedAt,
        summary: it.summary?.trim() || a.snippet || "",
        rank: i + 1,
        highlight: i === 0,
        priority: a.priority,
      });
    });
  }

  return analyzed;
}

export async function analyzeNews(
  topics: string[],
  articles: RawArticle[],
  priorityTopics: string[] = []
): Promise<NewsletterAnalysis> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || articles.length === 0) {
    return heuristicAnalysis(topics, articles, priorityTopics);
  }

  // Limitamos lo que mandamos al modelo.
  const input = articles.slice(0, 50).map((a, i) => ({
    id: i,
    title: a.title,
    source: a.source,
    topic: a.topic,
    priority: a.priority,
    snippet: a.snippet,
    publishedAt: a.publishedAt,
  }));

  const priorityLine =
    priorityTopics.length > 0
      ? `\nEl usuario marcó como PRIORITARIOS estos temas: ${priorityTopics.join(", ")}. Mencionálos primero en el análisis general.`
      : "";

  const system = `Sos el editor de un newsletter diario de noticias personalizado. El usuario sigue estos temas: ${topics.join(", ")}.${priorityLine}
Recibís una lista de noticias del día (cada una con id y su "topic"). Tu tarea:
1. Escribí un "summary" general del día en español rioplatense neutro: 2 a 4 frases con lo más importante para alguien interesado en esos temas, empezando por lo prioritario. Claro, sin sensacionalismo.
2. Para CADA tema, elegí las 3 noticias MÁS RELEVANTES de ese tema y rankéalas: "rank" 1 = la más relevante, 2 y 3 las siguientes. Descartá el resto (NO las incluyas). Descartá también ruido, duplicados o noticias que NO tratan realmente del tema (aunque mencionen la palabra).
3. Para cada noticia elegida devolvé su id, un "summary" de UNA sola línea (qué pasó, por qué importa) y su "rank".
Respondé SOLO con JSON válido, sin texto extra, con esta forma exacta:
{"summary":"...","items":[{"id":0,"summary":"...","rank":1}]}`;

  const user = `Noticias de hoy:\n${JSON.stringify(input)}`;

  // Probamos cada modelo free en orden hasta que uno devuelva JSON parseable.
  for (const model of MODELS) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_SITE_URL ?? "https://control.io",
          "X-Title": "control.io newsletter",
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });

      // 429 (rate limit) / 404 (modelo caído) → probamos el siguiente.
      if (!res.ok) continue;

      const data = await res.json();
      const content: string | undefined = data?.choices?.[0]?.message?.content;
      if (!content) continue;

      const parsed = JSON.parse(stripJson(content)) as {
        summary?: string;
        items?: { id: number; summary?: string; rank?: number }[];
      };
      if (!parsed.items || !Array.isArray(parsed.items)) continue;

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
    } catch {
      // JSON inválido o error de red → probamos el siguiente modelo.
      continue;
    }
  }

  // Ningún modelo respondió bien → ranking heurístico.
  return heuristicAnalysis(topics, articles, priorityTopics);
}
