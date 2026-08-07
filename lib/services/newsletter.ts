// Orquestador del newsletter: ingesta (Google News RSS) → análisis (IA) →
// guardado → aviso (push + WhatsApp).

import { fetchNewsForTopics, isReputableSource } from "./news";
import { fetchMediaCandidates } from "./media-feeds";
import { mergeCandidates } from "./brief/merge-candidates";
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
import {
  applyNorthReasons,
  effectiveTopics,
  syncChannelBriefItems,
} from "@/lib/services/brief/sources";
import { sendPushToUser } from "@/lib/push/send";
import { sendText } from "@/lib/whatsapp/kapso";
import { getCircleContacts } from "@/lib/db/circle";
import { rankDueContacts } from "@/lib/circle-cadence";

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
  // El Norte manda sobre los temas sueltos: si el usuario declaró sus frentes,
  // la edición se busca con eso. Si todavía no, se conserva lo que ya tenía.
  const desdeNorte = await effectiveTopics(userId, {
    topics: opts.topics,
    priorityTopics: opts.priorityTopics ?? [],
  }).catch(() => ({
    topics: opts.topics,
    priorityTopics: opts.priorityTopics ?? [],
    fromNorth: false,
  }));

  const topics = desdeNorte.topics.map((t) => t.trim()).filter(Boolean);
  if (topics.length === 0) {
    throw new Error("Sin temas configurados");
  }
  const priorityTopics = desdeNorte.priorityTopics
    .map((t) => t.trim())
    .filter(Boolean);

  // Dos fuentes que se compensan. Google News busca por tema pero sólo entrega
  // el titular: su `description` no tiene una palabra del artículo y sus
  // enlaces son identificadores opacos que no llevan a ningún texto. Los feeds
  // de los medios no buscan por tema, pero traen resumen de verdad y el enlace
  // directo a la nota. Con las dos hay de qué elegir y con qué escribir.
  const [raw, media] = await Promise.all([
    fetchNewsForTopics(topics, {
      language: opts.language,
      country: opts.country,
      perTopic: 8,
      priorityTopics,
      perPriorityTopic: 12,
    }),
    fetchMediaCandidates(topics).catch(() => []),
  ]);

  const candidates = mergeCandidates(raw, media, topics, isReputableSource);
  const analysis = await analyzeNews(topics, candidates, priorityTopics, opts.aiDeadlineMs);
  const savedEdition = await saveEdition(
    userId,
    analysis.summary,
    analysis.articles
  );
  await syncNewsBriefItems(savedEdition.id, analysis.articles);

  // Los canales propios de los referentes. Un feed caído no tumba la edición.
  await syncChannelBriefItems(userId, savedEdition.id).catch(() => {});
  // Y por qué está cada pieza, atada al frente al que sirve.
  await applyNorthReasons(userId, savedEdition.id).catch(() => {});

  await refreshSocialContentForEdition(
    userId,
    savedEdition.id,
    opts.briefLength ?? "NORMAL"
  ).catch(() => {
    // Una red social nunca bloquea las noticias ni la edición principal.
  });
  await generateRadarForUser(
    userId,
    opts.discoveryLevel ?? "BALANCED",
    {
      articles: raw,
      priorityTopics,
    }
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

/**
 * A quién le toca hoy, para el aviso diario.
 *
 * Mi Círculo no ve las conversaciones de nadie: esto sale de las cadencias que
 * la propia persona declaró.
 */
async function dueTodayNames(userId: string): Promise<string[]> {
  const contacts = await getCircleContacts(userId).catch(() => []);
  return rankDueContacts(contacts).map((contact) => contact.name);
}

/**
 * El aviso diario.
 *
 * Durante la transición desde Instagram el gancho no puede ser el contenido —
 * ahí Instagram gana siempre. El gancho es la persona que espera, y por eso
 * abre el mensaje. Y por eso el aviso sale aunque hoy no haya una sola noticia:
 * el día que la app tiene menos contenido es justo el día que no puede
 * quedarse callada.
 */
async function notifyDailyCircle(
  userId: string,
  edition: SerializedEdition | null,
  count: number,
  people: string[],
  whatsappNumber: string | null,
  channels: { push: boolean; whatsapp: boolean }
): Promise<void> {
  const vinculo =
    people.length === 0
      ? null
      : people.length === 1
        ? `Hoy: escribile a ${people[0]}.`
        : `Hoy: ${people.slice(0, 2).join(" y ")} esperan noticias tuyas.`;

  // La edición se anuncia por lo que es. Un día sin nada se dice, no se disfraza.
  const lectura =
    count === 0
      ? "Hoy no hay nada que valga tu tiempo."
      : `${count} ${count === 1 ? "lectura" : "lecturas"} y termina.`;

  if (channels.push) {
    await sendPushToUser(userId, {
      title: vinculo ? "Tu círculo" : "📰 Tu ración de hoy",
      body: vinculo ? `${vinculo} ${lectura}` : lectura,
      url: "/newsletter",
    }).catch(() => {});
  }

  if (channels.whatsapp && whatsappNumber) {
    const cuerpo = vinculo
      ? `👋 *${vinculo}*\n\n${
          edition && count > 0
            ? buildWhatsappDigest(edition.articles, edition.summary)
            : `${lectura}\n\n${SITE_URL}/newsletter`
        }`
      : edition && count > 0
        ? buildWhatsappDigest(edition.articles, edition.summary)
        : `📰 ${lectura}\n\n${SITE_URL}/newsletter`;

    await sendText(whatsappNumber, cuerpo).catch(() => {
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

      // El gancho de la sección no es el contenido: es la persona que espera.
      // Por eso el aviso también sale en un día sin noticias, si hay alguien.
      const people = await dueTodayNames(cfg.userId);

      // Con varias ventanas, la clave atómica habilita un aviso por horario sin
      // duplicarlo cuando el pinger reintenta durante la misma hora.
      const shouldNotify =
        (cfg.notifyPush || cfg.notifyWhatsapp) &&
        (result.count > 0 || people.length > 0) &&
        (hasMultipleWindows
          ? await claimDeliveryWindow(cfg.userId, hour)
          : !alreadyExisted);

      if (shouldNotify) {
        await notifyDailyCircle(
          cfg.userId,
          result.edition,
          result.count,
          people,
          cfg.whatsappNumber,
          { push: cfg.notifyPush, whatsapp: cfg.notifyWhatsapp },
        );
        notified++;
      }
    } catch (err) {
      console.error(`Newsletter error para ${cfg.userId}:`, err);
      errors++;
    }
  }

  return { total: configs.length, generated, aiUsed, notified, errors };
}
