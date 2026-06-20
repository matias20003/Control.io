"use server";

import { createClient } from "@/lib/supabase/server";
import { getTasks, createTask, toggleTask, deleteTask, updateTask } from "@/lib/db/tasks";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1, "Escribí la tarea").max(200),
  dueDate: z.string().optional(),
});

async function uid() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getTasksAction() {
  const userId = await uid();
  if (!userId) return [];
  return getTasks(userId);
}

export async function createTaskAction(formData: FormData) {
  const userId = await uid();
  if (!userId) return { error: "No autorizado" };

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const due = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  try {
    const task = await createTask(userId, { title: parsed.data.title, dueDate: due });
    return { task };
  } catch {
    return { error: "No se pudo crear la tarea" };
  }
}

export async function updateTaskAction(id: string, input: { title?: string; dueDate?: string | null }) {
  const userId = await uid();
  if (!userId) return { error: "No autorizado" };
  const data: { title?: string; dueDate?: Date | null } = {};
  if (input.title !== undefined) {
    if (!input.title.trim()) return { error: "El título no puede estar vacío" };
    data.title = input.title.trim();
  }
  if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  try {
    await updateTask(userId, id, data);
    return { ok: true };
  } catch {
    return { error: "No se pudo editar la tarea" };
  }
}

export async function toggleTaskAction(id: string) {
  const userId = await uid();
  if (!userId) return { error: "No autorizado" };
  try {
    await toggleTask(userId, id);
    return { ok: true };
  } catch {
    return { error: "No se pudo actualizar" };
  }
}

export async function deleteTaskAction(id: string) {
  const userId = await uid();
  if (!userId) return { error: "No autorizado" };
  try {
    await deleteTask(userId, id);
    return { ok: true };
  } catch {
    return { error: "No se pudo eliminar" };
  }
}
