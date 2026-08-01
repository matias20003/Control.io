"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  upsertConfig,
  markEditionRead,
  getConfig,
} from "@/lib/db/newsletter";
import { generateEditionForUser } from "@/lib/services/newsletter";
import {
  BRIEF_LENGTHS,
  BRIEF_PLATFORMS,
  BRIEF_SOURCE_CATEGORIES,
  DISCOVERY_LEVELS,
} from "@/lib/brief/types";
import {
  createBriefSource,
  deleteBriefSource,
  getBriefSources,
  isUniqueConstraintError,
  migrateLegacyBriefSources,
  recordBriefItemOpened,
  reopenBriefEdition,
  setBriefSourceActive,
  updateBriefSource,
  updateDiscoveryCandidate,
} from "@/lib/db/brief";

const configSchema = z.object({
  topics: z.array(z.string().min(1).max(80)).max(12),
  priorityTopics: z.array(z.string().min(1).max(80)).max(12).optional(),
  language: z.string().min(2).max(5).optional(),
  country: z.string().min(2).max(5).optional(),
  isActive: z.boolean().optional(),
  sendHour: z.number().int().min(0).max(23).optional(),
  sendHours: z
    .array(z.number().int().min(0).max(23))
    .min(1)
    .max(3)
    .refine((hours) => new Set(hours).size === hours.length, {
      message: "Los horarios de entrega no pueden repetirse",
    })
    .optional(),
  notifyOnReady: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
  discoveryLevel: z.enum(DISCOVERY_LEVELS).optional(),
  briefLength: z.enum(BRIEF_LENGTHS).optional(),
});

export async function saveNewsletterConfigAction(input: {
  topics: string[];
  priorityTopics?: string[];
  language?: string;
  country?: string;
  isActive?: boolean;
  sendHour?: number;
  sendHours?: number[];
  notifyOnReady?: boolean;
  notifyPush?: boolean;
  notifyWhatsapp?: boolean;
  discoveryLevel?: (typeof DISCOVERY_LEVELS)[number];
  briefLength?: (typeof BRIEF_LENGTHS)[number];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const parsed = configSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const config = await upsertConfig(user.id, parsed.data);
    revalidatePath("/newsletter");
    return { success: true, config };
  } catch {
    return { error: "No se pudo guardar la configuración" };
  }
}

export async function markNewsletterReadAction(editionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    await markEditionRead(user.id, editionId);
    revalidatePath("/newsletter");
    return { success: true };
  } catch {
    return { error: "No se pudo marcar como leído" };
  }
}

/** Genera la edición de hoy en el momento (botón "Generar ahora"). */
export async function generateNewsletterNowAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const config = await getConfig(user.id);

  try {
    const result = await generateEditionForUser(user.id, {
      topics: config.topics,
      priorityTopics: config.priorityTopics,
      language: config.language,
      country: config.country,
      briefLength: config.briefLength,
      discoveryLevel: config.discoveryLevel,
    });
    revalidatePath("/newsletter");
    return {
      success: true,
      edition: result.edition,
      usedAI: result.usedAI,
      count: result.count,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Sin temas configurados") {
      return { error: "Definí al menos un frente en El Norte antes de actualizar." };
    }
    return { error: "No se pudieron traer noticias en este momento." };
  }
}

const sourceSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre para reconocerla.").max(100),
  platform: z.enum(BRIEF_PLATFORMS),
  handleOrUrl: z
    .string()
    .trim()
    .min(1, "Ingresá un handle o una URL.")
    .max(500),
  category: z.enum(BRIEF_SOURCE_CATEGORIES),
  priority: z.boolean(),
});

export async function createBriefSourceAction(
  input: z.infer<typeof sourceSchema>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const source = await createBriefSource(user.id, parsed.data);
    revalidatePath("/newsletter");
    return { success: true, source };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Esa fuente ya está en tu lista." };
    }
    if (error instanceof Error && error.message === "INVALID_SOURCE") {
      return { error: "Revisá el handle o la URL de la fuente." };
    }
    return { error: "No pudimos agregar la fuente. Probá de nuevo." };
  }
}

export async function updateBriefSourceAction(
  sourceId: string,
  input: z.infer<typeof sourceSchema>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const id = z.string().min(1).max(200).safeParse(sourceId);
  const parsed = sourceSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return {
      error: parsed.success
        ? "La fuente no es válida."
        : parsed.error.issues[0].message,
    };
  }

  try {
    const source = await updateBriefSource(user.id, id.data, parsed.data);
    if (!source) return { error: "No encontramos esa fuente." };
    revalidatePath("/newsletter");
    return { success: true, source };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Esa fuente ya está en tu lista." };
    }
    if (error instanceof Error && error.message === "INVALID_SOURCE") {
      return { error: "Revisá el handle o la URL de la fuente." };
    }
    return { error: "No pudimos guardar los cambios." };
  }
}

export async function setBriefSourceActiveAction(
  sourceId: string,
  isActive: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const parsed = z
    .object({ sourceId: z.string().min(1).max(200), isActive: z.boolean() })
    .safeParse({ sourceId, isActive });
  if (!parsed.success) return { error: "La fuente no es válida." };

  const updated = await setBriefSourceActive(
    user.id,
    parsed.data.sourceId,
    parsed.data.isActive
  );
  if (!updated) return { error: "No encontramos esa fuente." };
  revalidatePath("/newsletter");
  return { success: true };
}

export async function deleteBriefSourceAction(sourceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const parsed = z.string().min(1).max(200).safeParse(sourceId);
  if (!parsed.success) return { error: "La fuente no es válida." };

  const deleted = await deleteBriefSource(user.id, parsed.data);
  if (!deleted) return { error: "No encontramos esa fuente." };
  revalidatePath("/newsletter");
  return { success: true };
}

const legacySourceSchema = z.object({
  name: z.string().trim().max(100),
  handle: z.string().trim().min(1).max(100),
  kind: z.enum(["familiar", "referente"]),
});

export async function migrateLegacyBriefSourcesAction(input: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const parsed = z.array(legacySourceSchema).max(50).safeParse(input);
  if (!parsed.success) {
    return { error: "Los datos anteriores de Mi círculo no son válidos." };
  }

  try {
    const result = await migrateLegacyBriefSources(user.id, parsed.data);
    const sources = await getBriefSources(user.id);
    revalidatePath("/newsletter");
    return { success: true, ...result, sources };
  } catch {
    return {
      error:
        "No pudimos migrar tus fuentes todavía. Tus datos locales siguen guardados.",
    };
  }
}

export async function updateRadarCandidateAction(
  candidateId: string,
  action: "ADD" | "TODAY_ONLY" | "DISMISS"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const parsed = z
    .object({
      candidateId: z.string().min(1).max(200),
      action: z.enum(["ADD", "TODAY_ONLY", "DISMISS"]),
    })
    .safeParse({ candidateId, action });
  if (!parsed.success) return { error: "La sugerencia no es válida." };

  try {
    const source = await updateDiscoveryCandidate(
      user.id,
      parsed.data.candidateId,
      parsed.data.action
    );
    revalidatePath("/newsletter");
    return { success: true, source };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Esa fuente ya está en tu lista." };
    }
    return { error: "No pudimos actualizar esa sugerencia." };
  }
}

export async function recordBriefItemOpenedAction(
  editionId: string,
  url: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const parsed = z
    .object({
      editionId: z.string().min(1).max(200),
      url: z.url().refine((value) => value.startsWith("https://")),
    })
    .safeParse({ editionId, url });
  if (!parsed.success) return { error: "El enlace no es válido." };

  try {
    const reviewedCount = await recordBriefItemOpened(
      user.id,
      parsed.data.editionId,
      parsed.data.url
    );
    return { success: true, reviewedCount };
  } catch {
    return { error: "No pudimos guardar el progreso." };
  }
}

export async function reopenBriefEditionAction(editionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const parsed = z.string().min(1).max(200).safeParse(editionId);
  if (!parsed.success) return { error: "La edición no es válida." };

  const reopened = await reopenBriefEdition(user.id, parsed.data);
  if (!reopened) return { error: "No encontramos esa edición." };
  revalidatePath("/newsletter");
  return { success: true };
}
