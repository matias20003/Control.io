"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createHabit,
  createOrganizationList,
  createOrganizationTask,
  toggleHabitCompletion,
  updateOrganizationTask,
} from "@/lib/db/organization";
import { syncTaskToGoogle } from "@/lib/google-organization";

async function userId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return user.id;
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
  recurrenceRule: z.string().max(500).nullable().optional(),
  reminderMinutes: z.number().int().min(0).max(10080).nullable().optional(),
});

function date(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Fecha inválida");
  return parsed;
}

export async function createOrganizationTaskAction(input: z.input<typeof taskSchema>) {
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
    revalidatePath("/tareas");
    return { ok: true, task };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear" };
  }
}

export async function updateOrganizationTaskAction(id: string, input: Partial<z.input<typeof taskSchema>> & { order?: number }) {
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
    revalidatePath("/tareas");
    return { ok: true, task };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar" };
  }
}

export async function createOrganizationListAction(input: { name: string; color?: string }) {
  try {
    const uid = await userId();
    const name = z.string().trim().min(1).max(80).parse(input.name);
    await createOrganizationList(uid, name, input.color);
    revalidatePath("/tareas");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la lista" };
  }
}

export async function createHabitAction(input: {
  name: string; icon?: string; frequency?: string; daysOfWeek?: number[]; scheduledTime?: string | null;
}) {
  try {
    const uid = await userId();
    const name = z.string().trim().min(1).max(120).parse(input.name);
    await createHabit(uid, { ...input, name });
    revalidatePath("/tareas");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el hábito" };
  }
}

export async function toggleHabitAction(habitId: string, day: string) {
  try {
    const uid = await userId();
    await toggleHabitCompletion(uid, habitId, new Date(`${day}T12:00:00Z`));
    revalidatePath("/tareas");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar" };
  }
}
