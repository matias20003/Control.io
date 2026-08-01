"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  archiveCircleContact,
  createCircleContact,
  recordCircleTouch,
  updateCircleContact,
  type CircleContact,
} from "@/lib/db/circle";
import { tierForCadence } from "@/lib/circle-cadence";

// Mi Círculo vive en /newsletter.
const ROUTE = "/newsletter";

async function userId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return user.id;
}

/** Forma única de respuesta, para que el cliente lea `result.error` sin estrechar tipos. */
export type CircleActionResult = {
  ok?: boolean;
  error?: string;
  contact?: CircleContact;
};

function fail(error: unknown, fallback: string): CircleActionResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

// El teléfono se guarda en dígitos (formato wa.me). Se aceptan espacios,
// guiones y paréntesis al tipear y se normalizan acá.
const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()+-]/g, ""))
  .refine((value) => value === "" || /^\d{8,15}$/.test(value), "Teléfono inválido")
  .transform((value) => (value === "" ? null : value));

const contactSchema = z.object({
  name: z.string().trim().min(1, "Falta el nombre").max(80),
  phone: phoneSchema.nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  cadenceDays: z.number().int().min(1).max(365),
  // Al dar de alta: true = "hablamos hoy" (no molesta desde el día 1),
  // false = "hace mucho / no me acuerdo" (sale a la superficie enseguida).
  contactedToday: z.boolean().optional(),
});

export async function createCircleContactAction(
  input: z.input<typeof contactSchema>,
): Promise<CircleActionResult> {
  try {
    const parsed = contactSchema.parse(input);
    const contact = await createCircleContact(await userId(), {
      name: parsed.name,
      phone: parsed.phone ?? null,
      note: parsed.note ?? null,
      cadenceDays: parsed.cadenceDays,
      tier: tierForCadence(parsed.cadenceDays),
      lastContactAt: parsed.contactedToday ? new Date() : null,
    });
    revalidatePath(ROUTE);
    return { ok: true, contact };
  } catch (error) {
    return fail(error, "No pudimos agregar a esta persona.");
  }
}

const updateSchema = contactSchema.partial().omit({ contactedToday: true });

export async function updateCircleContactAction(
  id: string,
  input: z.input<typeof updateSchema>,
): Promise<CircleActionResult> {
  try {
    const parsed = updateSchema.parse(input);
    const contact = await updateCircleContact(await userId(), id, {
      ...parsed,
      ...(parsed.cadenceDays !== undefined ? { tier: tierForCadence(parsed.cadenceDays) } : {}),
    });
    revalidatePath(ROUTE);
    return { ok: true, contact };
  } catch (error) {
    return fail(error, "No pudimos guardar los cambios.");
  }
}

/** El usuario declara que habló con esta persona. */
export async function recordCircleTouchAction(id: string): Promise<CircleActionResult> {
  try {
    const contact = await recordCircleTouch(await userId(), id);
    revalidatePath(ROUTE);
    return { ok: true, contact };
  } catch (error) {
    return fail(error, "No pudimos registrar la conversación.");
  }
}

export async function archiveCircleContactAction(id: string): Promise<CircleActionResult> {
  try {
    await archiveCircleContact(await userId(), id);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No pudimos sacar a esta persona del círculo.");
  }
}
