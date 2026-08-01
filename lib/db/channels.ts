/**
 * Mi Círculo · Referentes por obra — acceso a datos de los canales.
 *
 * Un referente puede tener uno o más canales (su blog y su canal de YouTube).
 * El que no tiene ninguno es "huérfano": sólo vive en una plataforma cerrada, y
 * es el único que habilita el puente. Ver docs/MI_CIRCULO.md.
 */

import { prisma } from "@/lib/prisma";
import type { ResolvedChannel } from "@/lib/services/brief/channels";

export type SerializedChannel = {
  id: string;
  sourceId: string;
  kind: string;
  siteUrl: string;
  feedUrl: string;
  title: string | null;
  status: string;
  lastError: string | null;
  lastFetchedAt: string | null;
};

type ChannelRow = {
  id: string;
  sourceId: string;
  kind: string;
  siteUrl: string;
  feedUrl: string;
  title: string | null;
  status: string;
  lastError: string | null;
  lastFetchedAt: Date | null;
};

export function serializeChannel(row: ChannelRow): SerializedChannel {
  return { ...row, lastFetchedAt: row.lastFetchedAt?.toISOString() ?? null };
}

const CHANNEL_FIELDS = {
  id: true,
  sourceId: true,
  kind: true,
  siteUrl: true,
  feedUrl: true,
  title: true,
  status: true,
  lastError: true,
  lastFetchedAt: true,
} as const;

/** Todos los canales del usuario, agrupados por fuente. */
export async function getChannelsBySource(
  userId: string,
): Promise<Map<string, SerializedChannel[]>> {
  const rows = await prisma.sourceChannel.findMany({
    where: { source: { userId } },
    select: CHANNEL_FIELDS,
    orderBy: { createdAt: "asc" },
  });
  const grouped = new Map<string, SerializedChannel[]>();
  for (const row of rows) {
    const current = grouped.get(row.sourceId) ?? [];
    current.push(serializeChannel(row));
    grouped.set(row.sourceId, current);
  }
  return grouped;
}

export async function addChannel(
  userId: string,
  sourceId: string,
  channel: ResolvedChannel,
): Promise<SerializedChannel> {
  const source = await prisma.briefSource.findFirst({
    where: { id: sourceId, userId },
    select: { id: true },
  });
  if (!source) throw new Error("Fuente no encontrada");

  const row = await prisma.sourceChannel.upsert({
    where: { sourceId_feedUrl: { sourceId, feedUrl: channel.feedUrl } },
    create: {
      sourceId,
      kind: channel.kind,
      siteUrl: channel.siteUrl,
      feedUrl: channel.feedUrl,
      title: channel.title,
    },
    update: {
      kind: channel.kind,
      siteUrl: channel.siteUrl,
      title: channel.title,
      status: "ACTIVE",
      lastError: null,
    },
    select: CHANNEL_FIELDS,
  });
  return serializeChannel(row);
}

export async function deleteChannel(userId: string, id: string): Promise<void> {
  const found = await prisma.sourceChannel.findFirst({
    where: { id, source: { userId } },
    select: { id: true },
  });
  if (!found) throw new Error("Canal no encontrado");
  await prisma.sourceChannel.delete({ where: { id } });
}

/** Marca el resultado de una lectura, para que el estado del canal sea honesto. */
export async function markChannelFetch(
  id: string,
  result: { ok: boolean; error?: string; empty?: boolean },
): Promise<void> {
  await prisma.sourceChannel.update({
    where: { id },
    data: {
      lastFetchedAt: new Date(),
      status: result.ok ? (result.empty ? "EMPTY" : "ACTIVE") : "ERROR",
      lastError: result.ok ? null : (result.error ?? "Error desconocido"),
    },
  });
}

/** Canales activos de un usuario, para armar la edición del día. */
export async function getActiveChannelsForUser(userId: string) {
  return prisma.sourceChannel.findMany({
    where: { source: { userId, isActive: true }, status: { not: "ERROR" } },
    select: {
      id: true,
      sourceId: true,
      kind: true,
      feedUrl: true,
      title: true,
      source: { select: { id: true, name: true, priority: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 60,
  });
}

/**
 * Referentes sin ningún canal propio. Son los únicos que habilitan el puente, y
 * su cantidad es el número que tiene que incomodar y bajar.
 */
export async function getOrphanSources(userId: string) {
  const rows = await prisma.briefSource.findMany({
    where: {
      userId,
      isActive: true,
      category: { not: "CLOSE" },
      channels: { none: {} },
    },
    select: {
      id: true,
      name: true,
      socialAccounts: {
        select: { platform: true, handle: true, profileUrl: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    platform: row.socialAccounts[0]?.platform ?? null,
    handle: row.socialAccounts[0]?.handle ?? null,
    profileUrl: row.socialAccounts[0]?.profileUrl ?? null,
  }));
}

export type CoverageStats = {
  total: number;
  withChannel: number;
  orphans: number;
  /** 0–100. Es la barra de la Etapa 1 de La Mudanza. */
  percent: number;
};

/** Cuánto de tus referentes ya vive dentro de Control.io. */
export async function getChannelCoverage(userId: string): Promise<CoverageStats> {
  const [total, withChannel] = await Promise.all([
    prisma.briefSource.count({
      where: { userId, isActive: true, category: { not: "CLOSE" } },
    }),
    prisma.briefSource.count({
      where: {
        userId,
        isActive: true,
        category: { not: "CLOSE" },
        channels: { some: {} },
      },
    }),
  ]);
  return {
    total,
    withChannel,
    orphans: total - withChannel,
    percent: total === 0 ? 0 : Math.round((withChannel / total) * 100),
  };
}
