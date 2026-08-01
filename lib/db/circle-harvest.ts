/**
 * Mi Círculo · La Cosecha — acceso a datos.
 *
 * Consumir sin convertir es entretenimiento. Cada conversión guarda de qué
 * fuente salió: eso es lo que después permite podar las que no dan nada.
 */

import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

/**
 * En qué se puede convertir una pieza.
 *
 * `NOTE` no crea otra entidad: el propio registro de cosecha es la nota,
 * guardada contra un frente del Norte. `Goal` en esta app es una meta
 * financiera (monto, moneda, vencimiento), así que colgarle la nota de un
 * artículo sería forzar un acoplamiento que no significa nada.
 */
export type HarvestOutcome = "TASK" | "HABIT" | "NOTE";

export type SerializedHarvest = {
  id: string;
  itemTitle: string;
  itemUrl: string;
  sourceId: string | null;
  frontId: string | null;
  outcome: string;
  outcomeId: string | null;
  createdAt: string;
};

export async function recordHarvest(
  userId: string,
  input: {
    itemTitle: string;
    itemUrl: string;
    sourceId?: string | null;
    frontId?: string | null;
    outcome: HarvestOutcome;
    outcomeId?: string | null;
  },
): Promise<SerializedHarvest> {
  const row = await prisma.circleHarvest.create({
    data: {
      userId,
      itemTitle: encrypt(input.itemTitle) ?? input.itemTitle,
      itemUrl: input.itemUrl,
      sourceId: input.sourceId ?? null,
      frontId: input.frontId ?? null,
      outcome: input.outcome,
      outcomeId: input.outcomeId ?? null,
    },
  });
  return {
    id: row.id,
    itemTitle: decrypt(row.itemTitle) ?? row.itemTitle,
    itemUrl: row.itemUrl,
    sourceId: row.sourceId,
    frontId: row.frontId,
    outcome: row.outcome,
    outcomeId: row.outcomeId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Las piezas guardadas como nota contra un frente del Norte. */
export async function getHarvestNotes(
  userId: string,
  frontId?: string | null,
): Promise<SerializedHarvest[]> {
  const rows = await prisma.circleHarvest.findMany({
    where: { userId, outcome: "NOTE", ...(frontId ? { frontId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    itemTitle: decrypt(row.itemTitle) ?? row.itemTitle,
    itemUrl: row.itemUrl,
    sourceId: row.sourceId,
    frontId: row.frontId,
    outcome: row.outcome,
    outcomeId: row.outcomeId,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Las URLs ya cosechadas, para no ofrecer convertir dos veces lo mismo. */
export async function getHarvestedUrls(userId: string, since: Date): Promise<Set<string>> {
  const rows = await prisma.circleHarvest.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { itemUrl: true },
  });
  return new Set(rows.map((row) => row.itemUrl));
}

export type SourceYield = {
  sourceId: string;
  name: string;
  conversions: number;
  lastConversionAt: string | null;
  /** Días sin producir nada. Null si nunca produjo. */
  daysSinceLastConversion: number | null;
  /** La app va a sugerir sacarla. */
  suggestPruning: boolean;
};

export type HarvestReport = {
  /** Piezas abiertas en el período (lo que "consumiste"). */
  opened: number;
  /** Piezas que se convirtieron en algo. */
  converted: number;
  /** 0–100. La métrica que reemplaza al tiempo de pantalla. */
  conversionRate: number;
  byOutcome: { task: number; habit: number; note: number };
  sources: SourceYield[];
  /** Fuentes que hace 60 días o más que no producen nada. */
  toPrune: SourceYield[];
};

const PRUNE_AFTER_DAYS = 60;

/**
 * El informe mensual: qué leíste, qué se convirtió y qué fuentes se ganaron el
 * lugar. Mientras todos los algoritmos expanden tu feed, este lo achica.
 */
export async function getHarvestReport(
  userId: string,
  since: Date,
  today = new Date(),
): Promise<HarvestReport> {
  const [harvests, sources, openedCount] = await Promise.all([
    prisma.circleHarvest.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { outcome: true, sourceId: true, createdAt: true },
    }),
    prisma.briefSource.findMany({
      where: { userId, isActive: true, category: { not: "CLOSE" } },
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.briefFeedback.count({
      where: { userId, action: "OPENED", createdAt: { gte: since } },
    }),
  ]);

  const converted = harvests.length;
  const byOutcome = {
    task: harvests.filter((h) => h.outcome === "TASK").length,
    habit: harvests.filter((h) => h.outcome === "HABIT").length,
    note: harvests.filter((h) => h.outcome === "NOTE").length,
  };

  // Última conversión por fuente, mirando todo el historial y no sólo el período:
  // sugerir podar por falta de datos recientes sería injusto.
  const lastBySource = await prisma.circleHarvest.groupBy({
    by: ["sourceId"],
    where: { userId, sourceId: { not: null } },
    _max: { createdAt: true },
    _count: { _all: true },
  });
  const lastMap = new Map(
    lastBySource.map((row) => [
      row.sourceId!,
      { last: row._max.createdAt, total: row._count._all },
    ]),
  );

  const yields: SourceYield[] = sources.map((source) => {
    const stat = lastMap.get(source.id);
    const last = stat?.last ?? null;
    const days = last
      ? Math.floor((today.getTime() - last.getTime()) / 86_400_000)
      : Math.floor((today.getTime() - source.createdAt.getTime()) / 86_400_000);
    return {
      sourceId: source.id,
      name: source.name,
      conversions: stat?.total ?? 0,
      lastConversionAt: last?.toISOString() ?? null,
      daysSinceLastConversion: last ? days : null,
      // Sólo se sugiere podar lo que tuvo tiempo de demostrar algo.
      suggestPruning: days >= PRUNE_AFTER_DAYS && (stat?.total ?? 0) === 0,
    };
  });

  return {
    opened: openedCount,
    converted,
    conversionRate:
      openedCount === 0
        ? 0
        : Math.min(100, Math.round((converted / openedCount) * 100)),
    byOutcome,
    sources: yields.sort((a, b) => b.conversions - a.conversions),
    toPrune: yields.filter((item) => item.suggestPruning),
  };
}
