import "server-only";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { createExam } from "@/lib/db/study-system";

// ─────────────────────────────────────────────
// Config: URL secreta iCal de Google (cifrada). Sin OAuth.
// ─────────────────────────────────────────────
export type GcalView = { connected: boolean };

export async function getGcalView(userId: string): Promise<GcalView> {
  const row = await prisma.studySettings.findUnique({ where: { userId }, select: { gcalIcsUrl: true } });
  return { connected: !!row?.gcalIcsUrl };
}

async function getGcalUrl(userId: string): Promise<string | null> {
  const row = await prisma.studySettings.findUnique({ where: { userId }, select: { gcalIcsUrl: true } });
  return row?.gcalIcsUrl ? decrypt(row.gcalIcsUrl) : null;
}

export async function setGcalUrl(userId: string, url: string): Promise<void> {
  await prisma.studySettings.upsert({
    where: { userId },
    create: { userId, gcalIcsUrl: encrypt(url) },
    update: { gcalIcsUrl: encrypt(url) },
  });
}

export async function disconnectGcal(userId: string): Promise<void> {
  await prisma.studySettings.updateMany({ where: { userId }, data: { gcalIcsUrl: null } });
}

// ─────────────────────────────────────────────
// Parser mínimo de iCal (VEVENT) con recurrencia semanal/diaria simple.
// ─────────────────────────────────────────────
export type CalEvent = { title: string; start: Date; allDay: boolean };

const BYDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Parsea un valor DTSTART a Date (UTC). Para all-day usa mediodía UTC (= mismo día ARG). */
function parseDt(value: string, params: string): { date: Date; allDay: boolean } | null {
  const isDate = /VALUE=DATE(?!-TIME)/.test(params) || /^\d{8}$/.test(value);
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mi, ss, z] = m;
  if (isDate || !hh) {
    return { date: new Date(Date.UTC(+y, +mo - 1, +d, 12, 0, 0)), allDay: true };
  }
  if (z) {
    return { date: new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi, +(ss || "0"))), allDay: false };
  }
  // Con TZID o naïve: interpretamos como hora de Argentina (UTC-3).
  return { date: new Date(Date.UTC(+y, +mo - 1, +d, +hh + 3, +mi, +(ss || "0"))), allDay: false };
}

function unescape(s: string): string {
  return s.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

/** Expande una regla RRULE simple (WEEKLY/DAILY) dentro de [from, to]. */
function expand(start: Date, rrule: string | null, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const within = (d: Date) => d >= from && d <= to;
  if (!rrule) { if (within(start)) out.push(start); return out; }

  const parts = Object.fromEntries(rrule.split(";").map((p) => p.split("=")) as [string, string][]);
  const freq = parts.FREQ;
  const interval = Math.max(1, parseInt(parts.INTERVAL || "1", 10));
  const count = parts.COUNT ? parseInt(parts.COUNT, 10) : Infinity;
  const until = parts.UNTIL ? parseDt(parts.UNTIL.replace(/Z$/, "Z"), "")?.date ?? to : to;
  const hardEnd = until < to ? until : to;
  let emitted = 0;

  if (freq === "WEEKLY") {
    const days = (parts.BYDAY ? parts.BYDAY.split(",") : []).map((d) => BYDAY[d.slice(-2)]).filter((n) => n !== undefined);
    const targetDays = days.length ? days : [start.getUTCDay()];
    // arrancamos en la semana de `from`, hasta hardEnd
    const cur = new Date(start);
    let guard = 0;
    while (cur <= hardEnd && emitted < count && guard < 500) {
      for (const dow of targetDays) {
        const occ = new Date(cur);
        const delta = (dow - occ.getUTCDay() + 7) % 7;
        occ.setUTCDate(occ.getUTCDate() + delta);
        if (occ >= start && occ <= hardEnd && within(occ) && emitted < count) { out.push(new Date(occ)); }
      }
      cur.setUTCDate(cur.getUTCDate() + 7 * interval);
      emitted++; guard++;
    }
  } else if (freq === "DAILY") {
    const cur = new Date(start);
    let guard = 0;
    while (cur <= hardEnd && emitted < count && guard < 400) {
      if (within(cur)) out.push(new Date(cur));
      cur.setUTCDate(cur.getUTCDate() + interval);
      emitted++; guard++;
    }
  } else {
    // otras frecuencias: al menos el evento base
    if (within(start)) out.push(start);
  }
  return out;
}

/** Trae y parsea los próximos eventos del calendario del usuario. */
export async function fetchUpcomingEvents(userId: string, daysAhead = 21): Promise<{ ok: boolean; error?: string; events: CalEvent[] }> {
  const url = await getGcalUrl(userId);
  if (!url) return { ok: false, error: "Calendario no conectado", events: [] };

  let text: string;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "control.io" } });
    if (!res.ok) return { ok: false, error: `El calendario respondió ${res.status}. Revisá la URL secreta.`, events: [] };
    text = await res.text();
  } catch {
    return { ok: false, error: "No pude descargar el calendario", events: [] };
  }
  if (!/BEGIN:VCALENDAR/.test(text)) return { ok: false, error: "Esa URL no es un calendario iCal válido", events: [] };

  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const now = new Date();
  const from = new Date(now.getTime() - 2 * 86_400_000);
  const to = new Date(now.getTime() + daysAhead * 86_400_000);

  const events: CalEvent[] = [];
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);
  for (const blk of blocks) {
    const body = blk.split("END:VEVENT")[0];
    const summaryM = body.match(/(?:^|\n)SUMMARY(?:;[^:]*)?:(.*)/);
    const dtM = body.match(/(?:^|\n)DTSTART([^:\n]*):([^\r\n]+)/);
    const rruleM = body.match(/(?:^|\n)RRULE:([^\r\n]+)/);
    if (!dtM) continue;
    const parsed = parseDt(dtM[2].trim(), dtM[1] || "");
    if (!parsed) continue;
    const title = summaryM ? unescape(summaryM[1]).slice(0, 120) : "(sin título)";
    for (const occ of expand(parsed.date, rruleM ? rruleM[1].trim() : null, from, to)) {
      events.push({ title, start: occ, allDay: parsed.allDay });
    }
  }
  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { ok: true, events: events.slice(0, 60) };
}

// Palabras que delatan un parcial/examen/entrega (para importarlos como fechas).
const EXAM_RE = /parcial|final|examen|recuperatorio|coloquio|entrega|tp\b|trabajo pr[aá]ctico/i;

export async function detectExamEvents(userId: string, daysAhead = 90): Promise<CalEvent[]> {
  const r = await fetchUpcomingEvents(userId, daysAhead);
  if (!r.ok) return [];
  const seen = new Set<string>();
  return r.events.filter((e) => {
    if (!EXAM_RE.test(e.title)) return false;
    const key = `${e.title}|${e.start.toISOString().slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Detecta parciales/entregas del calendario y los crea como fechas (matchea la materia por sigla o nombre). */
export async function importDetectedExams(userId: string): Promise<{ imported: number; unmatched: string[] }> {
  const events = await detectExamEvents(userId);
  if (!events.length) return { imported: 0, unmatched: [] };

  const [subjects, existing] = await Promise.all([
    prisma.studySubject.findMany({ where: { userId }, select: { id: true, code: true, name: true } }),
    prisma.studyExam.findMany({ where: { userId }, select: { title: true, examDate: true } }),
  ]);
  const existKey = new Set(existing.map((e) => `${e.title.toLowerCase()}|${e.examDate.toISOString().slice(0, 10)}`));

  let imported = 0;
  const unmatched: string[] = [];
  for (const ev of events) {
    const t = ev.title.toLowerCase();
    const subj = subjects.find(
      (s) => new RegExp(`\\b${escapeRe(s.code.toLowerCase())}\\b`).test(t) || (s.name.length > 3 && t.includes(s.name.toLowerCase()))
    );
    if (!subj) { unmatched.push(ev.title); continue; }
    const key = `${ev.title.toLowerCase()}|${ev.start.toISOString().slice(0, 10)}`;
    if (existKey.has(key)) continue;
    await createExam(userId, { subjectId: subj.id, title: ev.title.slice(0, 120), examDate: ev.start, importance: 3 });
    existKey.add(key);
    imported++;
  }
  return { imported, unmatched: [...new Set(unmatched)].slice(0, 10) };
}
