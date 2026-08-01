"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createHabit,
  createOrganizationList,
  createOrganizationTask,
  deleteHabit,
  deleteOrganizationList,
  deleteOrganizationTask,
  reorderOrganizationLists,
  toggleHabitCompletion,
  updateHabit,
  updateOrganizationList,
  updateOrganizationTask,
  type OrganizationTask,
} from "@/lib/db/organization";
import { deleteTaskFromGoogle, syncTaskToGoogle } from "@/lib/google-organization";

// La sección vive en /calendario. /tareas es sólo un redirect, así que
// revalidarla no refresca nada.
const ROUTE = "/calendario";

async function userId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return user.id;
}

/**
 * Forma única de respuesta para toda la sección. Si cada action devolviera su
 * propia unión ({ok,…} | {error}), el cliente no podría leer `result.error` sin
 * estrechar el tipo en cada llamada.
 */
export type OrganizationActionResult = {
  ok?: boolean;
  error?: string;
  task?: OrganizationTask;
  movedToInbox?: number;
};

function fail(error: unknown, fallback: string): OrganizationActionResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  scheduledStart: z.string().nullable().optional(),
  scheduledEnd: z.string().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional(),
  urgent: z.boolean().optional(),
  important: z.boolean().optional(),
  listId: z.string().nullable().optional(),
  someday: z.boolean().optional(),
  recurrenceRule: z.string().max(500).nullable().optional(),
  reminderMinutes: z.number().int().min(0).max(10080).nullable().optional(),
});

function date(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Fecha inválida");
  return parsed;
}

// ── Tareas ───────────────────────────────────────────────────

export async function createOrganizationTaskAction(input: z.input<typeof taskSchema>): Promise<OrganizationActionResult> {
  try {
    const uid = await userId();
    const parsed = taskSchema.parse(input);
    const task = await createOrganizationTask(uid, {
      ...parsed,
      dueDate: date(parsed.dueDate),
      scheduledStart: date(parsed.scheduledStart),
      scheduledEnd: date(parsed.scheduledEnd),
    });
    if (task.scheduledStart) await syncTaskToGoogle(uid, task.id).catch(() => null);
    revalidatePath(ROUTE);
    return { ok: true, task };
  } catch (error) {
    return fail(error, "No se pudo crear");
  }
}

export async function updateOrganizationTaskAction(id: string, input: Partial<z.input<typeof taskSchema>> & { order?: number }): Promise<OrganizationActionResult> {
  try {
    const uid = await userId();
    const parsed = taskSchema.partial().extend({ order: z.number().int().optional() }).parse(input);
    const task = await updateOrganizationTask(uid, id, {
      ...parsed,
      ...(parsed.dueDate !== undefined ? { dueDate: date(parsed.dueDate) } : {}),
      ...(parsed.scheduledStart !== undefined ? { scheduledStart: date(parsed.scheduledStart) } : {}),
      ...(parsed.scheduledEnd !== undefined ? { scheduledEnd: date(parsed.scheduledEnd) } : {}),
    } as Parameters<typeof updateOrganizationTask>[2]);
    if (task.scheduledStart || task.syncStatus === "PENDING") await syncTaskToGoogle(uid, id).catch(() => null);
    revalidatePath(ROUTE);
    return { ok: true, task };
  } catch (error) {
    return fail(error, "No se pudo actualizar");
  }
}

export async function deleteOrganizationTaskAction(id: string): Promise<OrganizationActionResult> {
  try {
    const uid = await userId();
    const { googleEventId, googleCalendarId } = await deleteOrganizationTask(uid, id);
    // El evento espejo se limpia después: si Google falla, la tarea ya se borró.
    await deleteTaskFromGoogle(uid, googleEventId, googleCalendarId).catch(() => null);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo borrar la tarea");
  }
}

/** Reintenta la sincronización de una tarea que quedó en ERROR. */
export async function retryTaskSyncAction(id: string): Promise<OrganizationActionResult> {
  try {
    const uid = await userId();
    await syncTaskToGoogle(uid, id);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo sincronizar con Google");
  }
}

// ── Listas ───────────────────────────────────────────────────

export async function createOrganizationListAction(input: { name: string; color?: string; icon?: string | null }): Promise<OrganizationActionResult> {
  try {
    const uid = await userId();
    const name = z.string().trim().min(1).max(80).parse(input.name);
    await createOrganizationList(uid, name, input.color, input.icon);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo crear la lista");
  }
}

export async function updateOrganizationListAction(id: string, input: { name?: string; color?: string; icon?: string | null }): Promise<OrganizationActionResult> {
  try {
    const uid = await userId();
    const parsed = z.object({
      name: z.string().trim().min(1).max(80).optional(),
      color: z.string().trim().max(20).optional(),
      icon: z.string().trim().max(8).nullable().optional(),
    }).parse(input);
    await updateOrganizationList(uid, id, parsed);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo actualizar la lista");
  }
}

export async function deleteOrganizationListAction(id: string): Promise<OrganizationActionResult> {
  try {
    const uid = await userId();
    const { movedToInbox } = await deleteOrganizationList(uid, id);
    revalidatePath(ROUTE);
    return { ok: true, movedToInbox };
  } catch (error) {
    return fail(error, "No se pudo borrar la lista");
  }
}

export async function reorderOrganizationListsAction(ids: string[]): Promise<OrganizationActionResult> {
  try {
    const uid = await userId();
    await reorderOrganizationLists(uid, z.array(z.string()).max(200).parse(ids));
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo reordenar");
  }
}

// ── Hábitos ──────────────────────────────────────────────────

const habitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  icon: z.string().trim().max(8).nullable().optional(),
  color: z.string().trim().max(20).optional(),
  frequency: z.enum(["DAILY", "WEEKLY"]).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  targetPerPeriod: z.number().int().min(1).max(50).optional(),
  scheduledTime: z.string().trim().max(5).nullable().optional(),
});

export async function createHabitAction(input: z.input<typeof habitSchema>): Promise<OrganizationActionResult> {
  try {
    const uid = await userId();
    await createHabit(uid, habitSchema.parse(input));
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo crear el hábito");
  }
}

export async function updateHabitAction(id: string, input: Partial<z.input<typeof habitSchema>>): Promise<OrganizationActionResult> {
  try {
    const uid = await userId();
    await updateHabit(uid, id, habitSchema.partial().parse(input));
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo actualizar el hábito");
  }
}

export async function deleteHabitAction(id: string): Promise<OrganizationActionResult> {
  try {
    const uid = await userId();
    await deleteHabit(uid, id);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo borrar el hábito");
  }
}

export async function toggleHabitAction(habitId: string, day: string): Promise<OrganizationActionResult> {
  try {
    const uid = await userId();
    await toggleHabitCompletion(uid, habitId, new Date(`${day}T12:00:00Z`));
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (error) {
    return fail(error, "No se pudo actualizar");
  }
}
