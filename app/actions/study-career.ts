"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  addPrerequisite, createStudyPlan, deletePrerequisiteSafe, deleteStudyPlan, deleteSubject,
  rebalancePlan, togglePlanItem, upsertSubject,
} from "@/lib/db/study-career";

/**
 * Acciones de la carrera y de los planes de estudio.
 *
 * Todas exigen ser el dueño: la sección Estudio sigue detrás del gate mientras
 * se prueba, y una server action sin ese chequeo sería la puerta de atrás que
 * lo saltea.
 */

async function ownerId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) throw new Error("No autorizado");
  return user.id;
}

export type StudyActionResult = { ok?: boolean; error?: string; missingMinutes?: number };

function fail(error: unknown, fallback: string): StudyActionResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

function revalidate() {
  revalidatePath("/estudio");
  revalidatePath("/hoy");
  revalidatePath("/organizacion");
}

const STATUSES = ["PENDIENTE", "CURSANDO", "CURSADA_APROBADA", "APROBADA", "LIBRE", "ABANDONADA"] as const;
const KINDS = ["CURSAR_NECESITA_CURSADA", "CURSAR_NECESITA_APROBADA", "RENDIR_NECESITA_APROBADA"] as const;

const subjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(20),
  type: z.enum(["anual", "cuatrimestral"]).optional(),
  planYear: z.number().int().min(1).max(9).nullable().optional(),
  status: z.enum(STATUSES).optional(),
  cursadaGrade: z.number().min(0).max(10).nullable().optional(),
  finalGrade: z.number().min(0).max(10).nullable().optional(),
  promoted: z.boolean().optional(),
});

export async function saveSubjectAction(input: z.input<typeof subjectSchema>): Promise<StudyActionResult> {
  try {
    await upsertSubject(await ownerId(), subjectSchema.parse(input));
    revalidate();
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo guardar la materia");
  }
}

export async function deleteSubjectAction(id: string): Promise<StudyActionResult> {
  try {
    await deleteSubject(await ownerId(), id);
    revalidate();
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo borrar la materia");
  }
}

export async function addPrerequisiteAction(
  subjectId: string, requiredId: string, kind: (typeof KINDS)[number],
): Promise<StudyActionResult> {
  try {
    await addPrerequisite(await ownerId(), subjectId, requiredId, z.enum(KINDS).parse(kind));
    revalidate();
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo agregar la correlativa");
  }
}

export async function removePrerequisiteAction(id: string): Promise<StudyActionResult> {
  try {
    await deletePrerequisiteSafe(await ownerId(), id);
    revalidate();
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo quitar la correlativa");
  }
}

const planSchema = z.object({
  examId: z.string().min(1),
  minutesPerDay: z.array(z.number().int().min(0).max(720)).length(7),
  reviewDays: z.number().int().min(0).max(14),
  items: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    minutes: z.number().int().min(5).max(600),
    weight: z.number().int().min(1).max(3),
    isReview: z.boolean().optional(),
  })).min(1).max(300),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createStudyPlanAction(input: z.input<typeof planSchema>): Promise<StudyActionResult> {
  try {
    await createStudyPlan(await ownerId(), planSchema.parse(input));
    revalidate();
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo crear el plan");
  }
}

/** El botón que salva el plan cuando te atrasaste. */
export async function rebalancePlanAction(planId: string, today: string): Promise<StudyActionResult> {
  try {
    const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(today);
    const result = await rebalancePlan(await ownerId(), planId, day);
    revalidate();
    return { ok: true, missingMinutes: result.missingMinutes };
  } catch (error) {
    return fail(error, "No se pudo reacomodar el plan");
  }
}

export async function togglePlanItemAction(itemId: string): Promise<StudyActionResult> {
  try {
    await togglePlanItem(await ownerId(), itemId);
    revalidate();
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo marcar");
  }
}

export async function deleteStudyPlanAction(planId: string): Promise<StudyActionResult> {
  try {
    await deleteStudyPlan(await ownerId(), planId);
    revalidate();
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo borrar el plan");
  }
}
