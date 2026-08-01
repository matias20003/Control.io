"use server";

/**
 * Mi Círculo · acciones de Referentes por obra, El Norte, La Cosecha, La
 * Mudanza y el puente. Cercanos vive en app/actions/circle.ts.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveChannel } from "@/lib/services/brief/channels";
import {
  addChannel,
  deleteChannel,
  getChannelCoverage,
  type SerializedChannel,
} from "@/lib/db/channels";
import {
  createFront,
  deleteFront,
  markNorthReviewed,
  reorderFronts,
  updateFront,
  type SerializedFront,
} from "@/lib/db/circle-north";
import { suggestTopics } from "@/lib/circle-north";
import { recordHarvest, type HarvestOutcome } from "@/lib/db/circle-harvest";
import { createHabit, createOrganizationTask } from "@/lib/db/organization";
import {
  closeBridgeVisit,
  decideInventoryItem,
  importInventory,
  openBridgeVisit,
  recordReinstall,
  setMigrationStage,
  type SerializedBridgeVisit,
  type SerializedInventoryItem,
  type SerializedMigration,
} from "@/lib/db/circle-migration";
import {
  MIGRATION_STAGES,
  INVENTORY_DECISIONS,
  parseFollowingFile,
  type InventoryDecision,
  type MigrationStage,
} from "@/lib/circle-inventory";

const ROUTE = "/newsletter";

async function userId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return user.id;
}

export type CircleSystemResult = {
  ok?: boolean;
  error?: string;
  channel?: SerializedChannel;
  front?: SerializedFront;
  migration?: SerializedMigration;
  inventoryItem?: SerializedInventoryItem;
  visit?: SerializedBridgeVisit;
  imported?: number;
  alreadyThere?: number;
  coveragePercent?: number;
  orphan?: boolean;
};

function fail(error: unknown, fallback: string): CircleSystemResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

// ─── Referentes por obra ─────────────────────────────────────────────────────

/**
 * No se pide el `@`: se pregunta dónde publica lo que sirve. Si esa dirección
 * no tiene un canal abierto, se responde `orphan: true` — que no es un error,
 * es información honesta y alimenta el contador del puente.
 */
export async function resolveChannelAction(
  sourceId: string,
  url: string,
): Promise<CircleSystemResult> {
  try {
    const uid = await userId();
    const resolution = await resolveChannel(url);
    if (!resolution.ok) {
      return { ok: false, orphan: resolution.orphan, error: resolution.reason };
    }
    const channel = await addChannel(uid, sourceId, resolution.channel);
    const coverage = await getChannelCoverage(uid);
    revalidatePath(ROUTE);
    return { ok: true, channel, coveragePercent: coverage.percent };
  } catch (error) {
    return fail(error, "No pudimos revisar esa dirección.");
  }
}

export async function deleteChannelAction(id: string): Promise<CircleSystemResult> {
  try {
    await deleteChannel(await userId(), id);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No pudimos sacar ese canal.");
  }
}

// ─── El Norte ────────────────────────────────────────────────────────────────

const frontSchema = z.object({
  label: z.string().trim().min(1, "Falta el frente").max(80),
  detail: z.string().trim().max(300).nullable().optional(),
  topics: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
});

export async function createFrontAction(
  input: z.input<typeof frontSchema>,
): Promise<CircleSystemResult> {
  try {
    const parsed = frontSchema.parse(input);
    // Si no eligió términos, se proponen a partir de cómo lo escribió. Son un
    // punto de partida editable, no una verdad.
    const topics =
      parsed.topics && parsed.topics.length > 0
        ? parsed.topics
        : suggestTopics(parsed.label, parsed.detail);
    const front = await createFront(await userId(), {
      label: parsed.label,
      detail: parsed.detail ?? null,
      topics,
    });
    revalidatePath(ROUTE);
    return { ok: true, front };
  } catch (error) {
    return fail(error, "No pudimos guardar ese frente.");
  }
}

export async function updateFrontAction(
  id: string,
  input: z.input<typeof frontSchema>,
): Promise<CircleSystemResult> {
  try {
    const parsed = frontSchema.partial().parse(input);
    const front = await updateFront(await userId(), id, {
      ...parsed,
      detail: parsed.detail ?? null,
    });
    revalidatePath(ROUTE);
    return { ok: true, front };
  } catch (error) {
    return fail(error, "No pudimos guardar los cambios.");
  }
}

export async function deleteFrontAction(id: string): Promise<CircleSystemResult> {
  try {
    await deleteFront(await userId(), id);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No pudimos sacar ese frente.");
  }
}

export async function reorderFrontsAction(ids: string[]): Promise<CircleSystemResult> {
  try {
    await reorderFronts(await userId(), ids);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No pudimos reordenar tus frentes.");
  }
}

export async function markNorthReviewedAction(): Promise<CircleSystemResult> {
  try {
    await markNorthReviewed(await userId());
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No pudimos anotar la revisión.");
  }
}

// ─── La Cosecha ──────────────────────────────────────────────────────────────

const harvestSchema = z.object({
  itemTitle: z.string().trim().min(1).max(300),
  itemUrl: z.string().trim().url(),
  sourceId: z.string().nullable().optional(),
  frontId: z.string().nullable().optional(),
  outcome: z.enum(["TASK", "HABIT", "NOTE"]),
});

/**
 * Convierte una pieza en algo que vive en la app. Es el corazón de La Cosecha:
 * lo que no se convierte fue entretenimiento.
 */
export async function harvestItemAction(
  input: z.input<typeof harvestSchema>,
): Promise<CircleSystemResult> {
  try {
    const parsed = harvestSchema.parse(input);
    const uid = await userId();
    const outcome = parsed.outcome as HarvestOutcome;

    // NOTE no crea otra entidad: el propio registro de cosecha es la nota.
    let outcomeId: string | null = null;

    if (outcome === "TASK") {
      const task = await createOrganizationTask(uid, {
        title: parsed.itemTitle.slice(0, 200),
        description: `De Mi Círculo: ${parsed.itemUrl}`,
      });
      outcomeId = task.id;
    } else if (outcome === "HABIT") {
      const habit = await createHabit(uid, { name: parsed.itemTitle.slice(0, 80) });
      outcomeId = habit.id;
    }

    await recordHarvest(uid, {
      itemTitle: parsed.itemTitle,
      itemUrl: parsed.itemUrl,
      sourceId: parsed.sourceId ?? null,
      frontId: parsed.frontId ?? null,
      outcome,
      outcomeId,
    });

    revalidatePath(ROUTE);
    revalidatePath("/calendario");
    return { ok: true };
  } catch (error) {
    return fail(error, "No pudimos convertir esa pieza.");
  }
}

// ─── La Mudanza ──────────────────────────────────────────────────────────────

/**
 * Importa el export de Instagram del propio usuario. Idempotente: volver a
 * subir el archivo no duplica ni pisa las decisiones ya tomadas.
 */
export async function importInventoryAction(raw: string): Promise<CircleSystemResult> {
  try {
    if (raw.length > 8_000_000) {
      throw new Error("Ese archivo es demasiado grande. Subí sólo following.json.");
    }
    const entries = parseFollowingFile(raw);
    if (entries.length === 0) {
      throw new Error(
        "No encontramos cuentas ahí. Tiene que ser el following.json del export de Instagram.",
      );
    }
    const result = await importInventory(await userId(), entries);
    revalidatePath(ROUTE);
    return { ok: true, imported: result.imported, alreadyThere: result.alreadyThere };
  } catch (error) {
    return fail(error, "No pudimos leer ese archivo.");
  }
}

export async function decideInventoryItemAction(
  id: string,
  decision: string,
): Promise<CircleSystemResult> {
  try {
    if (!INVENTORY_DECISIONS.includes(decision as InventoryDecision)) {
      throw new Error("Decisión inválida");
    }
    const inventoryItem = await decideInventoryItem(
      await userId(),
      id,
      decision as InventoryDecision,
    );
    revalidatePath(ROUTE);
    return { ok: true, inventoryItem };
  } catch (error) {
    return fail(error, "No pudimos guardar esa decisión.");
  }
}

export async function setMigrationStageAction(stage: string): Promise<CircleSystemResult> {
  try {
    if (!MIGRATION_STAGES.includes(stage as MigrationStage)) {
      throw new Error("Etapa inválida");
    }
    const migration = await setMigrationStage(await userId(), stage as MigrationStage);
    revalidatePath(ROUTE);
    return { ok: true, migration };
  } catch (error) {
    return fail(error, "No pudimos cambiar de etapa.");
  }
}

/** Volver a instalar Instagram no se castiga: se anota y se vuelve a convivir. */
export async function recordReinstallAction(): Promise<CircleSystemResult> {
  try {
    const migration = await recordReinstall(await userId());
    revalidatePath(ROUTE);
    return { ok: true, migration };
  } catch (error) {
    return fail(error, "No pudimos anotarlo.");
  }
}

// ─── El puente ───────────────────────────────────────────────────────────────

const bridgeSchema = z.object({
  handle: z.string().trim().min(1).max(40),
  intention: z.string().trim().min(3, "Escribí a qué vas.").max(200),
  sourceId: z.string().nullable().optional(),
});

export async function openBridgeVisitAction(
  input: z.input<typeof bridgeSchema>,
): Promise<CircleSystemResult> {
  try {
    const parsed = bridgeSchema.parse(input);
    const visit = await openBridgeVisit(await userId(), {
      handle: parsed.handle.replace(/^@/, ""),
      intention: parsed.intention,
      sourceId: parsed.sourceId ?? null,
    });
    revalidatePath(ROUTE);
    return { ok: true, visit };
  } catch (error) {
    return fail(error, "No pudimos abrir el puente.");
  }
}

export async function closeBridgeVisitAction(
  id: string,
  finding: string | null,
): Promise<CircleSystemResult> {
  try {
    const clean = finding?.trim() ? finding.trim().slice(0, 500) : null;
    await closeBridgeVisit(await userId(), id, clean);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No pudimos cerrar la visita.");
  }
}
