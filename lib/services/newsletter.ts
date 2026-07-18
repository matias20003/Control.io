// Orquestador del newsletter: ingesta (Google News RSS) → análisis (IA) → guardado.

import { fetchNewsForTopics } from "./news";
import { analyzeNews } from "./newsletter-ai";
import {
  saveEdition,
  getActiveConfigs,
  type SerializedEdition,
} from "@/lib/db/newsletter";

export type GenerateOptions = {
  topics: string[];
  language?: string;
  country?: string;
};

/** Genera y persiste la edición del día para un usuario. */
export async function generateEditionForUser(
  userId: string,
  opts: GenerateOptions
): Promise<{ edition: SerializedEdition; usedAI: boolean; count: number }> {
  const topics = opts.topics.map((t) => t.trim()).filter(Boolean);
  if (topics.length === 0) {
    throw new Error("Sin temas configurados");
  }

  const raw = await fetchNewsForTopics(topics, {
    language: opts.language,
    country: opts.country,
    perTopic: 8,
  });

  const analysis = await analyzeNews(topics, raw);
  const edition = await saveEdition(userId, analysis.summary, analysis.articles);

  return {
    edition,
    usedAI: analysis.usedAI,
    count: analysis.articles.length,
  };
}

/**
 * Genera la edición de hoy para TODOS los usuarios con newsletter activo.
 * Best-effort: un error en un usuario no frena al resto. Se invoca desde el
 * cron diario `recurring` (no agregamos un cron propio por el límite de 2 de
 * Vercel Hobby).
 */
export async function generateAllEditions(): Promise<{
  total: number;
  generated: number;
  aiUsed: number;
  errors: number;
}> {
  const configs = await getActiveConfigs();
  let generated = 0;
  let aiUsed = 0;
  let errors = 0;

  for (const cfg of configs) {
    try {
      const result = await generateEditionForUser(cfg.userId, {
        topics: cfg.topics,
        language: cfg.language,
        country: cfg.country,
      });
      generated++;
      if (result.usedAI) aiUsed++;
    } catch (err) {
      console.error(`Newsletter error para ${cfg.userId}:`, err);
      errors++;
    }
  }

  return { total: configs.length, generated, aiUsed, errors };
}
