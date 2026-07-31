import "server-only";
import { prisma } from "@/lib/prisma";

export type OrganizerSettings = {
  briefEnabled: boolean;
  briefHour: number;
  workStart: number;
  workEnd: number;
  focusMinutes: number;
  bufferMinutes: number;
};

export const DEFAULT_ORGANIZER_SETTINGS: OrganizerSettings = {
  briefEnabled: false,
  briefHour: 8,
  workStart: 8,
  workEnd: 20,
  focusMinutes: 50,
  bufferMinutes: 10,
};

export async function getOrganizerSettings(userId: string): Promise<OrganizerSettings> {
  const rows = await prisma.$queryRaw<{
    brief_enabled: boolean; brief_hour: number; work_start: number;
    work_end: number; focus_minutes: number; buffer_minutes: number;
  }[]>`
    SELECT brief_enabled, brief_hour, work_start, work_end, focus_minutes, buffer_minutes
    FROM whatsapp_organizer_settings WHERE user_id = ${userId} LIMIT 1`;
  const row = rows[0];
  return row ? {
    briefEnabled: row.brief_enabled,
    briefHour: row.brief_hour,
    workStart: row.work_start,
    workEnd: row.work_end,
    focusMinutes: row.focus_minutes,
    bufferMinutes: row.buffer_minutes,
  } : DEFAULT_ORGANIZER_SETTINGS;
}

export async function updateOrganizerSettings(
  userId: string,
  patch: Partial<OrganizerSettings>
): Promise<OrganizerSettings> {
  const current = await getOrganizerSettings(userId);
  const next = { ...current, ...patch };
  if (next.workStart < 0 || next.workStart > 23 || next.workEnd <= next.workStart || next.workEnd > 24) {
    throw new Error("horario de trabajo inválido");
  }
  if (next.briefHour < 0 || next.briefHour > 23) throw new Error("hora de resumen inválida");
  next.focusMinutes = Math.max(15, Math.min(next.focusMinutes, 240));
  next.bufferMinutes = Math.max(0, Math.min(next.bufferMinutes, 120));
  await prisma.$executeRaw`
    INSERT INTO whatsapp_organizer_settings
      (user_id, brief_enabled, brief_hour, work_start, work_end, focus_minutes, buffer_minutes)
    VALUES (
      ${userId}, ${next.briefEnabled}, ${next.briefHour}, ${next.workStart},
      ${next.workEnd}, ${next.focusMinutes}, ${next.bufferMinutes}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      brief_enabled = EXCLUDED.brief_enabled,
      brief_hour = EXCLUDED.brief_hour,
      work_start = EXCLUDED.work_start,
      work_end = EXCLUDED.work_end,
      focus_minutes = EXCLUDED.focus_minutes,
      buffer_minutes = EXCLUDED.buffer_minutes,
      updated_at = NOW()`;
  return next;
}
