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

const configSchema = z.object({
  topics: z.array(z.string().min(1).max(80)).max(12),
  priorityTopics: z.array(z.string().min(1).max(80)).max(12).optional(),
  language: z.string().min(2).max(5).optional(),
  country: z.string().min(2).max(5).optional(),
  isActive: z.boolean().optional(),
  sendHour: z.number().int().min(0).max(23).optional(),
  notifyOnReady: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
});

export async function saveNewsletterConfigAction(input: {
  topics: string[];
  priorityTopics?: string[];
  language?: string;
  country?: string;
  isActive?: boolean;
  sendHour?: number;
  notifyOnReady?: boolean;
  notifyPush?: boolean;
  notifyWhatsapp?: boolean;
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
  if (config.topics.length === 0) {
    return { error: "Agregá al menos un tema antes de generar." };
  }

  try {
    const result = await generateEditionForUser(user.id, {
      topics: config.topics,
      priorityTopics: config.priorityTopics,
      language: config.language,
      country: config.country,
    });
    revalidatePath("/newsletter");
    return {
      success: true,
      edition: result.edition,
      usedAI: result.usedAI,
      count: result.count,
    };
  } catch {
    return { error: "No se pudieron traer noticias en este momento." };
  }
}
