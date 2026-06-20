"use server";

import { createClient } from "@/lib/supabase/server";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/google";
import { fromZonedTime } from "date-fns-tz";

const ARG_TZ = "America/Argentina/Buenos_Aires";

async function uid() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// day = "YYYY-MM-DD", time = "HH:mm" → instante UTC interpretando hora Argentina.
function toStart(day: string, time: string): Date | null {
  const d = fromZonedTime(`${day}T${time || "09:00"}`, ARG_TZ);
  return isNaN(d.getTime()) ? null : d;
}

export async function createCalendarEventAction(input: {
  title: string; day: string; time: string; durationMin?: number;
}) {
  const userId = await uid();
  if (!userId) return { error: "No autorizado" };
  if (!input.title.trim()) return { error: "Falta el título" };
  const start = toStart(input.day, input.time);
  if (!start) return { error: "Fecha u hora inválida" };
  const dur = input.durationMin && input.durationMin > 0 ? input.durationMin : 60;
  const r = await createCalendarEvent(userId, { summary: input.title.trim(), start, end: new Date(start.getTime() + dur * 60_000) });
  return r.ok ? { ok: true } : { error: r.error ?? "No se pudo crear el evento" };
}

export async function updateCalendarEventAction(input: {
  id: string; title?: string; day?: string; time?: string; durationMin?: number;
}) {
  const userId = await uid();
  if (!userId) return { error: "No autorizado" };
  const patch: { summary?: string; start?: Date; end?: Date } = {};
  if (input.title?.trim()) patch.summary = input.title.trim();
  if (input.day && input.time !== undefined) {
    const start = toStart(input.day, input.time);
    if (!start) return { error: "Fecha u hora inválida" };
    const dur = input.durationMin && input.durationMin > 0 ? input.durationMin : 60;
    patch.start = start;
    patch.end = new Date(start.getTime() + dur * 60_000);
  }
  if (!patch.summary && !patch.start) return { error: "Nada que cambiar" };
  const r = await updateCalendarEvent(userId, input.id, patch);
  return r.ok ? { ok: true } : { error: r.error ?? "No se pudo editar el evento" };
}

export async function deleteCalendarEventAction(id: string) {
  const userId = await uid();
  if (!userId) return { error: "No autorizado" };
  const r = await deleteCalendarEvent(userId, id);
  return r.ok ? { ok: true } : { error: r.error ?? "No se pudo borrar el evento" };
}
