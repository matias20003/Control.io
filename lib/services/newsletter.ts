// Orquestador del newsletter: ingesta (Google News RSS) → análisis (IA) →
// guardado → aviso (push + WhatsApp).

import { fetchNewsForTopics } from "./news";
import { analyzeNews, type AnalyzedArticle } from "./newsletter-ai";
import {
  saveEdition,
  getActiveConfigs,
  getConfigsForHour,
  todayEditionExists,
  claimDeliveryWindow,
  getLatestEdition,
  type SerializedEdition,
} from "@/lib/db/newsletter";
import { syncNewsBriefItems } from "@/lib/db/brief";
import { refreshSocialContentForEdition } from "@/lib/services/social/sync";
import type { BriefLength, DiscoveryLevel } from "@/lib/brief/types";
import { generateRadarForUser } from "@/lib/services/brief/radar";
import { sendPushToUser } from "@/lib/push/send";
import { sendText } from "@/lib/whatsapp/kapso";

export type GenerateOptions = {
  topics: string[];
  priorityTopics?: string[];
  language?: string;
  country?: string;
  briefLength?: BriefLength;
  discoveryLevel?: DiscoveryLevel;
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
  const savedEdition = await saveEdition(
    userId,
    analysis.summary,
    analysis.articles
  );
  await syncNewsBriefItems(savedEdition.id, analysis.articles);
  await refreshSocialContentForEdition(
    userId,
    savedEdition.id,
    opts.briefLength ?? "NORMAL"
  ).catch(() => {
    // Una red social nunca bloquea las noticias ni la edición principal.
  });
  await generateRadarForUser(
    userId,
    opts.discoveryLevel ?? "BALANCED"
  ).catch(() => {
    // Radar es secundario y nunca bloquea el Brief.
  });
  const edition = (await getLatestEdition(userId)) ?? savedEdition;

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

/** Avisa al usuario que su edición está lista, según los canales que activó. */
async function notifyEditionReady(
  userId: string,
  edition: SerializedEdition,
  whatsappNumber: string | null,
  channels: { push: boolean; whatsapp: boolean }
): Promise<void> {
  const bodyShort =
    edition.summary.length > 160
      ? edition.summary.slice(0, 157).trimEnd() + "…"
      : edition.summary;

  if (channels.push) {
    await sendPushToUser(userId, {
      title: "📰 Tu newsletter de hoy",
      body: bodyShort || "Ya está lista tu edición de noticias del día.",
      url: "/newsletter",
    }).catch(() => {});
  }

  if (channels.whatsapp && whatsappNumber) {
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
        briefLength: cfg.briefLength,
        discoveryLevel: cfg.discoveryLevel,
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
      // Una sola ventana conserva el comportamiento histórico: no repite el
      // aviso si la edición del día ya existía.
      const hasMultipleWindows = cfg.sendHours.length > 1;
      const alreadyExisted = hasMultipleWindows
        ? false
        : await todayEditionExists(cfg.userId);

      const result = await generateEditionForUser(cfg.userId, {
        topics: cfg.topics,
        priorityTopics: cfg.priorityTopics,
        language: cfg.language,
        country: cfg.country,
        briefLength: cfg.briefLength,
        discoveryLevel: cfg.discoveryLevel,
        // El cron corre en background (maxDuration=300): le damos margen para
        // esperar a los modelos free lentos y usar IA de verdad.
        aiDeadlineMs: 120000,
      });
      generated++;
      if (result.usedAI) aiUsed++;

      // Con varias ventanas, la clave atómica habilita un aviso por horario sin
      // duplicarlo cuando el pinger reintenta durante la misma hora.
      const shouldNotify =
        (cfg.notifyPush || cfg.notifyWhatsapp) &&
        result.count > 0 &&
        (hasMultipleWindows
          ? await claimDeliveryWindow(cfg.userId, hour)
          : !alreadyExisted);

      if (shouldNotify) {
        await notifyEditionReady(cfg.userId, result.edition, cfg.whatsappNumber, {
          push: cfg.notifyPush,
          whatsapp: cfg.notifyWhatsapp,
        });
        notified++;
      }
    } catch (err) {
      console.error(`Newsletter error para ${cfg.userId}:`, err);
      errors++;
    }
  }

  return { total: configs.length, generated, aiUsed, notified, errors };
}
