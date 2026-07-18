// Análisis de noticias con IA vía OpenRouter (modelo gratuito).
// Si no hay OPENROUTER_API_KEY, cae a un ranking heurístico (sin IA).

import type { RawArticle } from "./news";

export type AnalyzedArticle = {
  title: string;
  url: string;
  source: string;
  topic: string;
  publishedAt: string | null;
  summary: string; // resumen de 1 línea
  highlight: boolean; // si es una de las sobresalientes del día
  priority: boolean; // el tema es prioritario para el usuario
};

export type NewsletterAnalysis = {
  summary: string; // análisis general del día (2-4 frases)
  articles: AnalyzedArticle[];
  usedAI: boolean;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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

/** Fallback sin IA: prioridad primero, luego por fecha; destaca lo más nuevo. */
function heuristicAnalysis(
  topics: string[],
  articles: RawArticle[]
): NewsletterAnalysis {
  const sorted = [...articles].sort((a, b) => {
    // Los temas prioritarios van primero.
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  const analyzed: AnalyzedArticle[] = sorted.map((a, i) => ({
    title: a.title,
    url: a.url,
    source: a.source,
    topic: a.topic,
    publishedAt: a.publishedAt,
    summary: a.snippet || "",
    highlight: i < Math.min(5, sorted.length),
    priority: a.priority,
  }));

  const summary =
    articles.length > 0
      ? `Hoy hay ${articles.length} noticias sobre ${topics.join(", ")}. Estas son las más recientes; activá el análisis con IA para un resumen priorizado.`
      : `No encontramos noticias nuevas sobre ${topics.join(", ")} hoy.`;

  return { summary, articles: analyzed, usedAI: false };
}

export async function analyzeNews(
  topics: string[],
  articles: RawArticle[],
  priorityTopics: string[] = []
): Promise<NewsletterAnalysis> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || articles.length === 0) {
    return heuristicAnalysis(topics, articles);
  }

  // Limitamos lo que mandamos al modelo.
  const input = articles.slice(0, 40).map((a, i) => ({
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
      ? `\nEl usuario marcó como PRIORITARIOS estos temas: ${priorityTopics.join(", ")}. Las noticias con "priority": true pertenecen a esos temas: dales preferencia clara al elegir lo sobresaliente del día y mencionálas primero en el análisis general.`
      : "";

  const system = `Sos el editor de un newsletter diario de noticias personalizado. El usuario sigue estos temas: ${topics.join(", ")}.${priorityLine}
Recibís una lista de noticias del día (con id). Tu tarea:
1. Escribí un "summary" general del día en español rioplatense neutro: 2 a 4 frases que capten lo más importante para alguien interesado en esos temas, empezando por lo prioritario. Claro, sin sensacionalismo.
2. Para cada noticia relevante devolvé su id, un "summary" de UNA sola línea (qué pasó, para qué sirve), y "highlight": true si es de lo más sobresaliente del día (máximo 6 en true). Priorizá las noticias de temas prioritarios para los highlight.
3. Descartá ruido, duplicados o noticias irrelevantes: no las incluyas.
Respondé SOLO con JSON válido, sin texto extra, con esta forma exacta:
{"summary":"...","items":[{"id":0,"summary":"...","highlight":true}]}`;

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
        items?: { id: number; summary?: string; highlight?: boolean }[];
      };
      if (!parsed.items || !Array.isArray(parsed.items)) continue;

      const byId = new Map(parsed.items.map((it) => [it.id, it]));
      const analyzed: AnalyzedArticle[] = [];
      for (let i = 0; i < input.length; i++) {
        const it = byId.get(i);
        if (!it) continue; // el modelo la descartó
        const a = articles[i];
        analyzed.push({
          title: a.title,
          url: a.url,
          source: a.source,
          topic: a.topic,
          publishedAt: a.publishedAt,
          summary: it.summary?.trim() || a.snippet || "",
          highlight: !!it.highlight,
          priority: a.priority,
        });
      }

      // orden: destacadas primero, dentro de cada grupo las prioritarias, luego por fecha
      analyzed.sort((a, b) => {
        if (a.highlight !== b.highlight) return a.highlight ? -1 : 1;
        if (a.priority !== b.priority) return a.priority ? -1 : 1;
        const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return tb - ta;
      });

      if (analyzed.length === 0) continue;

      return {
        summary:
          parsed.summary?.trim() ||
          heuristicAnalysis(topics, articles).summary,
        articles: analyzed,
        usedAI: true,
      };
    } catch {
      // JSON inválido o error de red → probamos el siguiente modelo.
      continue;
    }
  }

  // Ningún modelo respondió bien → ranking heurístico.
  return heuristicAnalysis(topics, articles);
}
