import type { GoogleCalendarEvent } from "@/lib/google";

const ARG_TZ = "America/Argentina/Buenos_Aires";
const WEEKDAYS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function argDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARG_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function zonedDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export type OrganizerQuery = {
  kind: "availability" | "agenda";
  from: Date;
  to: Date;
  hasSpecificTime: boolean;
  label: string;
};

export function parseOrganizerQuery(message: string, now = new Date()): OrganizerQuery | null {
  const text = normalize(message);
  const availability = /\b(libre|disponible|disponibilidad|hueco|ocupado|puedo agendar)\b/.test(text);
  const agenda = /\b(que tengo|tengo algo|mi agenda|agenda|eventos|reuniones|compromisos|como viene mi dia|como viene mi semana)\b/.test(text);
  if (!availability && !agenda) return null;

  const today = argDateParts(now);
  let target = zonedDate(today.year, today.month, today.day);
  let label = "hoy";
  if (/\bpasado manana\b/.test(text)) {
    target = addDays(target, 2);
    label = "pasado mañana";
  } else if (/\bmanana\b/.test(text)) {
    target = addDays(target, 1);
    label = "mañana";
  } else {
    const explicit = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (explicit) {
      const year = explicit[3] ? Number(explicit[3].length === 2 ? `20${explicit[3]}` : explicit[3]) : today.year;
      target = zonedDate(year, Number(explicit[2]), Number(explicit[1]));
      label = `${explicit[1]}/${explicit[2]}`;
    } else {
      const weekday = Object.entries(WEEKDAYS).find(([name]) => new RegExp(`\\b${name}\\b`).test(text));
      if (weekday) {
        const currentDow = target.getUTCDay();
        let delta = (weekday[1] - currentDow + 7) % 7;
        if (delta === 0 && /\b(proximo|que viene)\b/.test(text)) delta = 7;
        target = addDays(target, delta);
        label = weekday[0];
      }
    }
  }

  const range = text.match(/\b(?:de|entre)\s+(?:las\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:a|y)\s+(?:las\s+)?(\d{1,2})(?::(\d{2}))?/);
  const at = text.match(/\b(?:a las|tipo)\s+(\d{1,2})(?::(\d{2}))?/);
  let from = target;
  let to = addDays(target, 1);
  let hasSpecificTime = false;
  if (range) {
    const p = argDateParts(target);
    from = zonedDate(p.year, p.month, p.day, Number(range[1]), Number(range[2] ?? 0));
    to = zonedDate(p.year, p.month, p.day, Number(range[3]), Number(range[4] ?? 0));
    hasSpecificTime = true;
  } else if (at) {
    const p = argDateParts(target);
    from = zonedDate(p.year, p.month, p.day, Number(at[1]), Number(at[2] ?? 0));
    to = new Date(from.getTime() + 60 * 60_000);
    hasSpecificTime = true;
  }
  return { kind: availability ? "availability" : "agenda", from, to, hasSpecificTime, label };
}

function time(date: Date): string {
  return date.toLocaleTimeString("es-AR", {
    timeZone: ARG_TZ, hour: "2-digit", minute: "2-digit",
  });
}

function eventBounds(event: GoogleCalendarEvent): { start: Date; end: Date } {
  return { start: new Date(event.start), end: new Date(event.end) };
}

export function overlappingEvents(events: GoogleCalendarEvent[], from: Date, to: Date): GoogleCalendarEvent[] {
  return events.filter((event) => {
    if (!event.busy) return false;
    const bounds = eventBounds(event);
    return bounds.start < to && bounds.end > from;
  });
}

export function findFirstFreeSlot(
  events: GoogleCalendarEvent[],
  from: Date,
  to: Date,
  durationMinutes: number,
  opts: { workStart: number; workEnd: number; bufferMinutes: number }
): { start: Date; end: Date } | null {
  const duration = Math.max(15, durationMinutes) * 60_000;
  const buffer = Math.max(0, opts.bufferMinutes) * 60_000;
  let day = zonedDate(argDateParts(from).year, argDateParts(from).month, argDateParts(from).day);
  while (day < to) {
    const p = argDateParts(day);
    const dayStart = zonedDate(p.year, p.month, p.day, opts.workStart);
    const dayEnd = zonedDate(p.year, p.month, p.day, opts.workEnd);
    let cursor = from > dayStart ? from : dayStart;
    const busy = overlappingEvents(events, dayStart, dayEnd)
      .map(eventBounds)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    for (const block of busy) {
      if (cursor.getTime() + duration <= block.start.getTime() - buffer) {
        return { start: cursor, end: new Date(cursor.getTime() + duration) };
      }
      if (block.end.getTime() + buffer > cursor.getTime()) cursor = new Date(block.end.getTime() + buffer);
    }
    if (cursor.getTime() + duration <= Math.min(dayEnd.getTime(), to.getTime())) {
      return { start: cursor, end: new Date(cursor.getTime() + duration) };
    }
    day = addDays(day, 1);
  }
  return null;
}

export function formatOrganizerReply(query: OrganizerQuery, events: GoogleCalendarEvent[]): string {
  const relevant = overlappingEvents(events, query.from, query.to)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  if (query.kind === "availability" && query.hasSpecificTime) {
    if (!relevant.length) {
      return `✅ Sí, estás *libre ${query.label} de ${time(query.from)} a ${time(query.to)}* según tu Google Calendar.`;
    }
    return `⛔ No estás libre en ese horario. Tenés:\n\n${relevant.map(formatEvent).join("\n")}`;
  }
  if (query.kind === "agenda") {
    if (!relevant.length) return `📅 No tenés eventos en Google Calendar ${query.label}.`;
    return `📅 *Tu agenda para ${query.label}:*\n\n${relevant.map(formatEvent).join("\n")}`;
  }

  const p = argDateParts(query.from);
  const workStart = zonedDate(p.year, p.month, p.day, 8);
  const workEnd = zonedDate(p.year, p.month, p.day, 22);
  const busy = overlappingEvents(events, workStart, workEnd)
    .map(eventBounds).sort((a, b) => a.start.getTime() - b.start.getTime());
  const gaps: { start: Date; end: Date }[] = [];
  let cursor = workStart;
  for (const block of busy) {
    if (block.start > cursor && block.start.getTime() - cursor.getTime() >= 30 * 60_000) {
      gaps.push({ start: cursor, end: block.start });
    }
    if (block.end > cursor) cursor = block.end;
  }
  if (cursor < workEnd) gaps.push({ start: cursor, end: workEnd });
  if (!gaps.length) return `⛔ No encontré huecos de al menos 30 minutos ${query.label} entre las 08:00 y las 22:00.`;
  return `✅ *Horarios libres ${query.label}:*\n\n${gaps.slice(0, 6).map((gap) => `• ${time(gap.start)}–${time(gap.end)}`).join("\n")}`;
}

function formatEvent(event: GoogleCalendarEvent): string {
  if (event.allDay) return `• Todo el día · *${event.summary}*`;
  const start = new Date(event.start);
  const end = new Date(event.end);
  return `• ${time(start)}–${time(end)} · *${event.summary}*${event.location ? `\n  📍 ${event.location}` : ""}`;
}
