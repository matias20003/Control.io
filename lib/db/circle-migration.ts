/**
 * Mi Círculo · La Mudanza y el puente — acceso a datos.
 *
 * Un hábito no se saca, se reemplaza: las etapas existen para que nada se quite
 * antes de tener con qué sustituirlo. Ver docs/MI_CIRCULO.md.
 */

import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { serializeCircleContact, type CircleContact } from "@/lib/db/circle";
import { normalizeSocialSource } from "@/lib/brief/source-normalization";
import type { SerializedBriefSource } from "@/lib/brief/types";
import {
  cutChecklist,
  inventoryProgress,
  type CutChecklist,
  type InventoryDecision,
  type InventoryEntry,
  type InventoryProgress,
  type MigrationStage,
} from "@/lib/circle-inventory";

// ─── Estado de la mudanza ────────────────────────────────────────────────────

export type SerializedMigration = {
  stage: MigrationStage;
  inventoryUploadedAt: string | null;
  coexistStartedAt: string | null;
  uninstalledAt: string | null;
  reinstalledAt: string | null;
  /** Días desde que desinstaló, si lo hizo y no volvió. */
  daysWithout: number | null;
  /** Días que lleva conviviendo con Instagram. */
  coexistDays: number | null;
};

export async function getMigration(
  userId: string,
  today = new Date(),
): Promise<SerializedMigration> {
  const row = await prisma.circleMigration.findUnique({ where: { userId } });
  if (!row) {
    return {
      stage: "INVENTORY",
      inventoryUploadedAt: null,
      coexistStartedAt: null,
      uninstalledAt: null,
      reinstalledAt: null,
      daysWithout: null,
      coexistDays: null,
    };
  }

  const cortó = row.uninstalledAt;
  const volvió = row.reinstalledAt;
  const daysWithout =
    cortó && (!volvió || volvió < cortó)
      ? Math.floor((today.getTime() - cortó.getTime()) / 86_400_000)
      : null;

  return {
    stage: row.stage as MigrationStage,
    inventoryUploadedAt: row.inventoryUploadedAt?.toISOString() ?? null,
    coexistStartedAt: row.coexistStartedAt?.toISOString() ?? null,
    uninstalledAt: cortó?.toISOString() ?? null,
    reinstalledAt: volvió?.toISOString() ?? null,
    daysWithout,
    coexistDays: row.coexistStartedAt
      ? Math.floor((today.getTime() - row.coexistStartedAt.getTime()) / 86_400_000)
      : null,
  };
}

export async function setMigrationStage(
  userId: string,
  stage: MigrationStage,
): Promise<SerializedMigration> {
  const now = new Date();
  const marks: Record<string, Date> = {};
  if (stage === "COEXIST") marks.coexistStartedAt = now;
  if (stage === "CUT") marks.uninstalledAt = now;

  await prisma.circleMigration.upsert({
    where: { userId },
    create: { userId, stage, ...marks },
    update: { stage, ...marks },
  });
  return getMigration(userId);
}

/**
 * Volver a instalar Instagram no es un fracaso y no se castiga: se anota, se
 * vuelve a la convivencia y se sigue. Un producto que castiga la recaída se
 * desinstala él.
 */
export async function recordReinstall(userId: string): Promise<SerializedMigration> {
  await prisma.circleMigration.upsert({
    where: { userId },
    create: { userId, stage: "COEXIST", reinstalledAt: new Date() },
    update: { stage: "COEXIST", reinstalledAt: new Date() },
  });
  return getMigration(userId);
}

// ─── Inventario ──────────────────────────────────────────────────────────────

export type SerializedInventoryItem = {
  id: string;
  handle: string;
  fullName: string | null;
  decision: string;
  resolvedType: string | null;
  resolvedId: string | null;
};

export type InventoryDecisionResult = {
  inventoryItem: SerializedInventoryItem;
  contact?: CircleContact;
  source?: SerializedBriefSource;
};

export async function getInventory(
  userId: string,
  opts: { decision?: InventoryDecision; take?: number } = {},
): Promise<SerializedInventoryItem[]> {
  return prisma.circleInventoryItem.findMany({
    where: { userId, ...(opts.decision ? { decision: opts.decision } : {}) },
    select: {
      id: true,
      handle: true,
      fullName: true,
      decision: true,
      resolvedType: true,
      resolvedId: true,
    },
    orderBy: [{ decision: "asc" }, { handle: "asc" }],
    take: opts.take ?? 2000,
  });
}

/**
 * Guarda el inventario del export. Idempotente: volver a subir el archivo no
 * duplica ni pisa las decisiones ya tomadas.
 */
export async function importInventory(
  userId: string,
  entries: InventoryEntry[],
): Promise<{ imported: number; alreadyThere: number }> {
  if (entries.length === 0) return { imported: 0, alreadyThere: 0 };

  const existing = await prisma.circleInventoryItem.findMany({
    where: { userId, handle: { in: entries.map((entry) => entry.handle) } },
    select: { handle: true },
  });
  const known = new Set(existing.map((row) => row.handle));
  const nuevos = entries.filter((entry) => !known.has(entry.handle));

  if (nuevos.length > 0) {
    await prisma.circleInventoryItem.createMany({
      data: nuevos.map((entry) => ({
        userId,
        handle: entry.handle,
        fullName: entry.fullName,
      })),
      skipDuplicates: true,
    });
  }

  await prisma.circleMigration.upsert({
    where: { userId },
    create: { userId, stage: "INVENTORY", inventoryUploadedAt: new Date() },
    update: { inventoryUploadedAt: new Date() },
  });

  return { imported: nuevos.length, alreadyThere: known.size };
}

export async function decideInventoryItem(
  userId: string,
  id: string,
  decision: InventoryDecision,
): Promise<InventoryDecisionResult> {
  const result = await prisma.$transaction(async (tx) => {
    const found = await tx.circleInventoryItem.findFirst({
      where: { id, userId },
      select: {
        id: true,
        handle: true,
        fullName: true,
        decision: true,
        resolvedType: true,
        resolvedId: true,
      },
    });
    if (!found) throw new Error("Cuenta no encontrada en el inventario");

    // Una respuesta perdida no puede crear dos personas o dos referentes.
    if (found.decision !== "PENDING") return { inventoryItem: found };

    let contactRow = null;
    let sourceRow = null;
    let resolvedType: "CONTACT" | "SOURCE" | null = null;
    let resolvedId: string | null = null;

    if (decision === "PERSON") {
      const name = found.fullName?.trim() || `@${found.handle}`;
      contactRow = await tx.circleContact.create({
        data: {
          userId,
          name: encrypt(name) ?? name,
          phone: null,
          note: null,
          tier: "CLOSE",
          cadenceDays: 28,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          note: true,
          tier: true,
          cadenceDays: true,
          lastContactAt: true,
          createdAt: true,
        },
      });
      resolvedType = "CONTACT";
      resolvedId = contactRow.id;
    } else if (decision === "REFERENCE") {
      const normalized = normalizeSocialSource(found.handle, "INSTAGRAM");
      if (!normalized) throw new Error("El usuario de Instagram no es valido");
      sourceRow = await tx.briefSource.upsert({
        where: {
          userId_normalizedKey: { userId, normalizedKey: normalized.normalizedKey },
        },
        create: {
          userId,
          name: found.fullName?.trim() || `@${found.handle}`,
          sourceType: "PERSON",
          category: "REFERENCE",
          normalizedKey: normalized.normalizedKey,
          priority: false,
          socialAccounts: {
            create: {
              platform: normalized.platform,
              handle: normalized.handle,
              profileUrl: normalized.profileUrl,
            },
          },
        },
        update: { isActive: true, category: "REFERENCE" },
        include: { socialAccounts: { orderBy: { createdAt: "asc" }, take: 1 } },
      });
      resolvedType = "SOURCE";
      resolvedId = sourceRow.id;
    }

    const inventoryItem = await tx.circleInventoryItem.update({
      where: { id },
      data: { decision, resolvedType, resolvedId },
      select: {
        id: true,
        handle: true,
        fullName: true,
        decision: true,
        resolvedType: true,
        resolvedId: true,
      },
    });
    return { inventoryItem, contactRow, sourceRow };
  });

  const output: InventoryDecisionResult = { inventoryItem: result.inventoryItem };
  if ("contactRow" in result && result.contactRow) {
    output.contact = serializeCircleContact(result.contactRow, new Date());
  }
  if ("sourceRow" in result && result.sourceRow) {
    const account = result.sourceRow.socialAccounts[0] ?? null;
    output.source = {
      id: result.sourceRow.id,
      name: result.sourceRow.name,
      sourceType: result.sourceRow.sourceType,
      category: "REFERENCE",
      priority: result.sourceRow.priority,
      isActive: result.sourceRow.isActive,
      createdAt: result.sourceRow.createdAt.toISOString(),
      updatedAt: result.sourceRow.updatedAt.toISOString(),
      account: account
        ? {
            id: account.id,
            platform: account.platform as "INSTAGRAM",
            handle: account.handle,
            profileUrl: account.profileUrl,
            status: account.status,
            lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
          }
        : null,
    };
  }
  return output;
}

// ─── La línea de base ────────────────────────────────────────────────────────

export type CircleBaseline = {
  /** A cuántas cuentas seguía el día que se miró al espejo. */
  followedAtStart: number;
  /** Cuándo fue ese día. */
  capturedAt: string | null;
  /** Cómo quedó repartido: gente, obra y ruido. */
  people: number;
  references: number;
  noise: number;
  pending: number;
};

/**
 * El "412" del día 1.
 *
 * Es imposible de reconstruir después: o se captura cuando la persona sube su
 * export, o el espejo del mes 6 no tiene contra qué comparar y queda en números
 * absolutos, que no le prueban nada a nadie. Por eso los items del inventario
 * no se borran nunca — el total es la marca de dónde arrancó.
 */
export async function getBaseline(userId: string): Promise<CircleBaseline | null> {
  const [migration, grouped] = await Promise.all([
    prisma.circleMigration.findUnique({
      where: { userId },
      select: { inventoryUploadedAt: true },
    }),
    prisma.circleInventoryItem.groupBy({
      by: ["decision"],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
  if (total === 0) return null;

  const count = (decision: string) =>
    grouped.find((row) => row.decision === decision)?._count._all ?? 0;

  return {
    followedAtStart: total,
    capturedAt: migration?.inventoryUploadedAt?.toISOString() ?? null,
    people: count("PERSON"),
    references: count("REFERENCE"),
    noise: count("NOISE"),
    pending: count("PENDING"),
  };
}

export async function getInventoryProgress(userId: string): Promise<InventoryProgress> {
  const rows = await prisma.circleInventoryItem.findMany({
    where: { userId },
    select: { decision: true },
  });
  return inventoryProgress(rows);
}

// ─── Checklist del corte ─────────────────────────────────────────────────────

/** Reúne de toda la app lo que hace falta para poder cortar sin quedarse sin nada. */
export async function getCutChecklist(userId: string): Promise<CutChecklist> {
  const [peopleTotal, peopleWithPhone, referencesTotal, referencesWithChannel, pending] =
    await Promise.all([
      prisma.circleContact.count({ where: { userId, isActive: true } }),
      prisma.circleContact.count({
        where: { userId, isActive: true, phone: { not: null } },
      }),
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
      prisma.circleInventoryItem.count({ where: { userId, decision: "PENDING" } }),
    ]);

  return cutChecklist({
    peopleTotal,
    peopleWithPhone,
    referencesTotal,
    referencesWithChannel,
    pendingInventory: pending,
  });
}

// ─── El puente ───────────────────────────────────────────────────────────────

export type SerializedBridgeVisit = {
  id: string;
  handle: string;
  intention: string;
  finding: string | null;
  openedAt: string;
  closedAt: string | null;
};

/** Abre el puente dejando escrito a qué va. Sin intención no hay puente. */
export async function openBridgeVisit(
  userId: string,
  input: { handle: string; intention: string; sourceId?: string | null },
): Promise<SerializedBridgeVisit> {
  const row = await prisma.bridgeVisit.create({
    data: {
      userId,
      handle: input.handle,
      sourceId: input.sourceId ?? null,
      intention: encrypt(input.intention) ?? input.intention,
    },
  });
  return {
    id: row.id,
    handle: row.handle,
    intention: decrypt(row.intention) ?? row.intention,
    finding: null,
    openedAt: row.openedAt.toISOString(),
    closedAt: null,
  };
}

/** Cierra el puente con lo que encontró. Puede quedar vacío: no siempre hay algo. */
export async function closeBridgeVisit(
  userId: string,
  id: string,
  finding: string | null,
): Promise<void> {
  const found = await prisma.bridgeVisit.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!found) throw new Error("Visita no encontrada");
  await prisma.bridgeVisit.update({
    where: { id },
    data: { finding: encrypt(finding), closedAt: new Date() },
  });
}

export type BridgeCost = {
  visitsLast30Days: number;
  orphanCount: number;
  referenceCount: number;
};

/** Cuánto te está costando el puente. Este número tiene que incomodar y bajar. */
export async function getBridgeCost(userId: string, since: Date): Promise<BridgeCost> {
  const [visits, orphanCount, referenceCount] = await Promise.all([
    prisma.bridgeVisit.count({ where: { userId, openedAt: { gte: since } } }),
    prisma.briefSource.count({
      where: { userId, isActive: true, category: { not: "CLOSE" }, channels: { none: {} } },
    }),
    prisma.briefSource.count({
      where: { userId, isActive: true, category: { not: "CLOSE" } },
    }),
  ]);
  return { visitsLast30Days: visits, orphanCount, referenceCount };
}
