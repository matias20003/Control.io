/**
 * Mi Círculo · lo que aporta el usuario a su propia edición.
 *
 * Dos cosas que el pipeline de noticias no hace solo:
 *   1. Traer lo último de los canales propios de sus referentes.
 *   2. Explicar, pieza por pieza, a qué frente del Norte sirve.
 *
 * Todo es best-effort: un feed caído nunca puede tumbar la edición del día.
 */

import { prisma } from "@/lib/prisma";
import { fetchChannelItems } from "./channels";
import { getActiveChannelsForUser, markChannelFetch } from "@/lib/db/channels";
import { getFronts } from "@/lib/db/circle-north";
import { deriveTopics, frontForTopic, inclusionReasonForFront } from "@/lib/circle-north";

/** Cuántos canales se leen a la vez. Suficiente sin castigar a nadie. */
const CONCURRENCIA = 4;
const POR_CANAL = 3;

function contentKey(url: string): string {
  return url.trim().toLowerCase().slice(0, 300);
}

async function enTandas<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/**
 * Trae lo último de cada canal y lo guarda como piezas de la edición.
 * Devuelve cuántas piezas entraron.
 */
export async function syncChannelBriefItems(
  userId: string,
  editionId: string,
): Promise<number> {
  const channels = await getActiveChannelsForUser(userId);
  if (channels.length === 0) return 0;

  const fetched = await enTandas(channels, CONCURRENCIA, async (channel) => {
    const result = await fetchChannelItems(channel.feedUrl, POR_CANAL);
    await markChannelFetch(channel.id, {
      ok: result.ok,
      error: result.ok ? undefined : result.error,
      empty: result.ok && result.items.length === 0,
    }).catch(() => {});
    return { channel, result };
  });

  const rows: {
    contentKey: string;
    title: string;
    summary: string;
    url: string;
    publishedAt: Date | null;
    sourceId: string;
    sourceName: string;
    kind: string;
  }[] = [];

  for (const { channel, result } of fetched) {
    if (!result.ok) continue;
    for (const item of result.items) {
      rows.push({
        contentKey: contentKey(item.url),
        title: item.title.slice(0, 300),
        summary: item.summary?.slice(0, 500) ?? "",
        url: item.url,
        publishedAt: item.publishedAt,
        sourceId: channel.sourceId,
        sourceName: channel.source.name,
        kind: channel.kind,
      });
    }
  }

  if (rows.length === 0) return 0;

  // Lo más nuevo primero: en una edición finita, el orden es la curaduría.
  rows.sort(
    (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
  );

  const activeKeys = rows.map((row) => row.contentKey);
  await prisma.$transaction([
    prisma.briefItem.deleteMany({
      where: { editionId, kind: "CHANNEL", contentKey: { notIn: activeKeys } },
    }),
    ...rows.map((row, index) =>
      prisma.briefItem.upsert({
        where: { editionId_contentKey: { editionId, contentKey: row.contentKey } },
        create: {
          editionId,
          contentKey: row.contentKey,
          kind: "CHANNEL",
          sourceType: row.kind,
          sourceId: row.sourceId,
          title: row.title,
          summary: row.summary,
          url: row.url,
          topic: null,
          publishedAt: row.publishedAt,
          rank: index + 1,
          section: "SOURCES",
          inclusionReason: `Lo publicó ${row.sourceName}, una fuente que elegiste.`,
          metadata: { source: row.sourceName, channelKind: row.kind },
        },
        update: {
          title: row.title,
          summary: row.summary,
          rank: index + 1,
          publishedAt: row.publishedAt,
        },
      }),
    ),
  ]);

  return rows.length;
}

/**
 * Los temas con los que buscar, derivados del Norte. Si todavía no declaró
 * frentes, se conservan los temas que ya tenía configurados: no se le vacía la
 * edición a nadie por una función nueva.
 */
export async function effectiveTopics(
  userId: string,
  fallback: { topics: string[]; priorityTopics: string[] },
): Promise<{ topics: string[]; priorityTopics: string[]; fromNorth: boolean }> {
  const fronts = await getFronts(userId).catch(() => []);
  const derived = deriveTopics(fronts);
  if (derived.topics.length === 0) return { ...fallback, fromNorth: false };
  return {
    topics: derived.topics,
    priorityTopics:
      derived.priorityTopics.length > 0 ? derived.priorityTopics : fallback.priorityTopics,
    fromNorth: true,
  };
}

/**
 * Escribe en cada pieza a qué frente sirve. Sólo donde hay relación real: una
 * pieza sin razón declarada es preferible a una razón inventada.
 */
export async function applyNorthReasons(
  userId: string,
  editionId: string,
): Promise<number> {
  const fronts = await getFronts(userId).catch(() => []);
  if (fronts.length === 0) return 0;

  const items = await prisma.briefItem.findMany({
    where: { editionId, kind: "NEWS" },
    select: { id: true, topic: true },
  });

  const updates = items
    .map((item) => ({ item, front: frontForTopic(item.topic, fronts) }))
    .filter((pair) => pair.front !== null);

  if (updates.length === 0) return 0;

  await prisma.$transaction(
    updates.map(({ item, front }) =>
      prisma.briefItem.update({
        where: { id: item.id },
        data: { inclusionReason: inclusionReasonForFront(front) },
      }),
    ),
  );

  return updates.length;
}
