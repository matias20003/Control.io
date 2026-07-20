// Orquestador del newsletter: ingesta (Google News RSS) → análisis (IA) →
// guardado → aviso (push + WhatsApp).

import { fetchNewsForTopics } from "./news";
import { analyzeNews, type AnalyzedArticle } from "./newsletter-ai";
import {
  saveEdition,
  getActiveConfigs,
  getConfigsForHour,
  todayEditionExists,
  type SerializedEdition,
} from "@/lib/db/newsletter";
import { sendPushToUser } from "@/lib/push/send";
import { sendText } from "@/lib/whatsapp/kapso";

export type GenerateOptions = {
  topics: string[];
  priorityTopics?: string[];
  language?: string;
  country?: string;
  /** Presupuesto de la IA (ms). El cron (background) da más; "Generar ahora" menos. */
  aiDeadlineMs?: number;
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
  const priorityTopics = (opts.priorityTopics ?? [])
    .map((t) => t.trim())
    .filter(Boolean);

  const raw = await fetchNewsForTopics(topics, {
    language: opts.language,
    country: opts.country,
    perTopic: 8,
    priorityTopics,
    perPriorityTopic: 12,
  });

  const analysis = await analyzeNews(topics, raw, priorityTopics, opts.aiDeadlineMs);
  const edition = await saveEdition(userId, analysis.summary, analysis.articles);

  return {
    edition,
    usedAI: analysis.usedAI,
    count: analysis.articles.length,
  };
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://control.io";

/** Arma el texto de WhatsApp con el resumen + lo sobresaliente del día. */
function buildWhatsappDigest(articles: AnalyzedArticle[], summary: string): string {
  const highlights = articles.filter((a) => a.highlight).slice(0, 3);
  const lines = highlights.map((a) => `• ${a.title}`);
  const top = lines.length ? `\n\n*Top del día:*\n${lines.join("\n")}` : "";
  return `📰 *Tu newsletter de hoy*\n\n${summary}${top}\n\nLeelo completo 👉 ${SITE_URL}/newsletter`;
}

/** Avisa al usuario que su edición está lista (push + WhatsApp, best-effort). */
async function notifyEditionReady(
  userId: string,
  edition: SerializedEdition,
  whatsappNumber: string | null
): Promise<void> {
  const bodyShort =
    edition.summary.length > 160
      ? edition.summary.slice(0, 157).trimEnd() + "…"
      : edition.summary;

  await sendPushToUser(userId, {
    title: "📰 Tu newsletter de hoy",
    body: bodyShort || "Ya está lista tu edición de noticias del día.",
    url: "/newsletter",
  }).catch(() => {});

  if (whatsappNumber) {
    await sendText(
      whatsappNumber,
      buildWhatsappDigest(edition.articles, edition.summary)
    ).catch(() => {
      // fuera de la ventana de 24h o sin Kapso configurado → ya avisamos por push.
    });
  }
}

/**
 * Genera la edición de hoy para TODOS los usuarios con newsletter activo.
 * Best-effort: un error en un usuario no frena al resto. Se conserva para
 * disparos manuales / de respaldo (sin aviso, para no notificar dos veces).
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
        priorityTopics: cfg.priorityTopics,
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

/**
 * Genera la edición para los usuarios cuyo horario de envío (`sendHour`, hora
 * ARG) coincide con `hour`, y les avisa (push + WhatsApp). Lo invoca el cron
 * horario `/api/cron/newsletter`. Best-effort: un error no frena al resto.
 */
export async function generateEditionsForHour(hour: number): Promise<{
  total: number;
  generated: number;
  aiUsed: number;
  notified: number;
  errors: number;
}> {
  const configs = await getConfigsForHour(hour);
  let generated = 0;
  let aiUsed = 0;
  let notified = 0;
  let errors = 0;

  for (const cfg of configs) {
    try {
      // Si la edición de hoy ya existía, esto es una regeneración (el cron se
      // disparó más de una vez esta hora): NO volvemos a avisar.
      const alreadyExisted = await todayEditionExists(cfg.userId);

      const result = await generateEditionForUser(cfg.userId, {
        topics: cfg.topics,
        priorityTopics: cfg.priorityTopics,
        language: cfg.language,
        country: cfg.country,
        // El cron corre en background (maxDuration=300): le damos margen para
        // esperar a los modelos free lentos y usar IA de verdad.
        aiDeadlineMs: 120000,
      });
      generated++;
      if (result.usedAI) aiUsed++;

      // Avisamos solo la primera vez del día, si hay algo que leer y si el
      // usuario tiene el recordatorio activado.
      if (cfg.notifyOnReady && !alreadyExisted && result.count > 0) {
        await notifyEditionReady(cfg.userId, result.edition, cfg.whatsappNumber);
        notified++;
      }
    } catch (err) {
      console.error(`Newsletter error para ${cfg.userId}:`, err);
      errors++;
    }
  }

  return { total: configs.length, generated, aiUsed, notified, errors };
}
