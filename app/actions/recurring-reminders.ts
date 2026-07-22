"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createRecurringReminder,
  updateRecurringReminder,
  deleteRecurringReminder,
} from "@/lib/db/recurring-reminders";

const createSchema = z.object({
  text: z.string().trim().min(1).max(200),
  link: z.string().trim().max(500).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function createRecurringReminderAction(input: {
  text: string;
  link?: string;
  daysOfWeek: number[];
  hour: number;
  minute: number;
}) {
  const user = await requireUser();
  if (!user) return { error: "No autorizado" };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const reminder = await createRecurringReminder(user.id, parsed.data);
    revalidatePath("/tareas");
    revalidatePath("/calendario");
    return { success: true, reminder };
  } catch {
    return { error: "No se pudo crear el recordatorio" };
  }
}

export async function updateRecurringReminderAction(
  id: string,
  input: { text: string; link?: string; daysOfWeek: number[]; hour: number; minute: number }
) {
  const user = await requireUser();
  if (!user) return { error: "No autorizado" };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await updateRecurringReminder(user.id, id, {
      text: parsed.data.text,
      link: parsed.data.link ?? null, // si viene vacío, limpia el link
      daysOfWeek: parsed.data.daysOfWeek,
      hour: parsed.data.hour,
      minute: parsed.data.minute,
    });
    revalidatePath("/tareas");
    revalidatePath("/calendario");
    return { success: true };
  } catch {
    return { error: "No se pudo actualizar el recordatorio" };
  }
}

export async function toggleRecurringReminderAction(id: string, isActive: boolean) {
  const user = await requireUser();
  if (!user) return { error: "No autorizado" };
  try {
    await updateRecurringReminder(user.id, id, { isActive });
    revalidatePath("/tareas");
    return { success: true };
  } catch {
    return { error: "No se pudo actualizar" };
  }
}

export async function deleteRecurringReminderAction(id: string) {
  const user = await requireUser();
  if (!user) return { error: "No autorizado" };
  try {
    await deleteRecurringReminder(user.id, id);
    revalidatePath("/tareas");
    return { success: true };
  } catch {
    return { error: "No se pudo eliminar" };
  }
}
