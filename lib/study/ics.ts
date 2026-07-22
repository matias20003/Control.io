import "server-only";
import { prisma } from "@/lib/prisma";

const STAGE_LABEL: Record<string, string> = {
  "D0": "Estudio inicial", "D+1": "Repaso D+1", "D+3": "Repaso D+3",
  "D+7": "Repaso D+7", "D+16": "Repaso D+16", "MANT_SEM": "Mantenimiento", "MANT_QUIN": "Mantenimiento",
};

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** YYYYMMDD del Date (guardado ~12:00 UTC = mismo día ARG). */
function icsDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Genera el feed .ics con los repasos programados y los parciales del usuario. */
export async function buildStudyIcs(userId: string): Promise<string> {
  const [blocks, subjects, exams] = await Promise.all([
    prisma.studyBlock.findMany({
      where: { userId, status: "ACTIVO", nextReviewDate: { not: null } },
      select: { id: true, code: true, topic: true, reviewStage: true, reviewDuration: true, subjectId: true, nextReviewDate: true },
    }),
    prisma.studySubject.findMany({ where: { userId }, select: { id: true, code: true } }),
    prisma.studyExam.findMany({ where: { userId, done: false }, select: { id: true, title: true, examDate: true, subjectId: true } }),
  ]);
  const codeMap = new Map(subjects.map((s) => [s.id, s.code]));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//control.io//Estudio//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Estudio · control.io",
    "X-WR-TIMEZONE:America/Argentina/Buenos_Aires",
  ];

  for (const b of blocks) {
    if (!b.nextReviewDate) continue;
    const code = codeMap.get(b.subjectId) ?? "";
    const day = icsDate(b.nextReviewDate);
    lines.push(
      "BEGIN:VEVENT",
      `UID:block-${b.id}-${day}@controlio.site`,
      `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${esc(`📚 ${code} — ${b.topic}`)}`,
      `DESCRIPTION:${esc(`${STAGE_LABEL[b.reviewStage] ?? b.reviewStage} · ~${b.reviewDuration} min · ${b.code}`)}`,
      "END:VEVENT",
    );
  }

  for (const e of exams) {
    const code = codeMap.get(e.subjectId) ?? "";
    const day = icsDate(e.examDate);
    lines.push(
      "BEGIN:VEVENT",
      `UID:exam-${e.id}@controlio.site`,
      `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${esc(`📝 ${code} — ${e.title}`)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  // CRLF es lo correcto para ICS.
  return lines.join("\r\n");
}
