import "server-only";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

// Repaso espaciado: a los 1, 3, 7 y 16 días. Cubre desde el día siguiente hasta
// ~2 semanas — suficiente para llegar bien a un parcial sin estudiar todo junto.
export const SPACED_INTERVALS = [1, 3, 7, 16];

export type StudyNoteView = {
  id: string;
  subject: string;
  title: string;
  summary: string;
  source: string;
  createdAt: string;
};

export type ReviewView = {
  id: string;
  noteId: string;
  subject: string;
  title: string;
  dueDate: string;
  interval: number;
  done: boolean;
};

/**
 * Resume contenido de estudio con IA. Devuelve materia (adivinada si no viene),
 * un título corto y un resumen estructurado para repasar.
 */
export async function summarizeStudyContent(
  rawText: string,
  hintSubject?: string
): Promise<{ subject: string; title: string; summary: string }> {
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL?.split(",")[0]?.trim() || "openai/gpt-4o-mini";
  const text = rawText.slice(0, 45000); // cota de contexto

  if (!key) {
    return { subject: hintSubject || "General", title: "Apunte", summary: text.slice(0, 2000) };
  }

  const system =
    `Sos un asistente de estudio para un estudiante de la UTN (ingeniería). Te paso el ` +
    `contenido de una clase/apunte/PDF. Generá un RESUMEN para repasar: claro, ordenado, con ` +
    `los conceptos clave, definiciones y fórmulas si las hay. Usá viñetas y **negritas** en los ` +
    `términos importantes. Que sea completo pero conciso (para "pegar una leída" a la noche).\n` +
    `Respondé SOLO JSON: {"subject":"materia (2-4 palabras)","title":"título corto del tema","summary":"el resumen en markdown"}.` +
    (hintSubject ? `\nLa materia probablemente es: ${hintSubject}.` : "");

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error("llm");
    const j = await res.json();
    const p = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    return {
      subject: (p.subject || hintSubject || "General").toString().slice(0, 60),
      title: (p.title || "Apunte").toString().slice(0, 120),
      summary: (p.summary || text.slice(0, 2000)).toString(),
    };
  } catch {
    return { subject: hintSubject || "General", title: "Apunte", summary: text.slice(0, 2000) };
  }
}

/**
 * Crea una nota de estudio (resumen ya generado) y agenda su repaso espaciado.
 */
export async function createStudyNote(
  userId: string,
  data: { subject: string; title: string; summary: string; content?: string; source?: string }
): Promise<{ id: string; subject: string; title: string; reviewDates: Date[] }> {
  const note = await prisma.studyNote.create({
    data: {
      userId,
      subject: data.subject,
      title: data.title,
      summary: encrypt(data.summary) ?? data.summary,
      content: data.content ? encrypt(data.content) : null,
      source: data.source ?? "text",
    },
  });

  const now = new Date();
  const reviewDates: Date[] = [];
  await prisma.studyReview.createMany({
    data: SPACED_INTERVALS.map((interval) => {
      // Repaso a las 9:00 (hora local del server ≈ se dispara por el cron con
      // tolerancia). Guardamos el due a las 12:00 UTC ≈ 9 ARG.
      const due = new Date(now.getTime() + interval * 86_400_000);
      due.setUTCHours(12, 0, 0, 0);
      reviewDates.push(due);
      return {
        noteId: note.id,
        userId,
        subject: data.subject,
        title: data.title,
        dueDate: due,
        interval,
      };
    }),
  });

  return { id: note.id, subject: data.subject, title: data.title, reviewDates };
}

export async function getStudyNotes(userId: string, take = 100): Promise<StudyNoteView[]> {
  const rows = await prisma.studyNote.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    title: r.title,
    summary: decrypt(r.summary) ?? r.summary,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getUpcomingReviews(userId: string): Promise<ReviewView[]> {
  const rows = await prisma.studyReview.findMany({
    where: { userId, done: false },
    orderBy: { dueDate: "asc" },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    noteId: r.noteId,
    subject: r.subject,
    title: r.title,
    dueDate: r.dueDate.toISOString(),
    interval: r.interval,
    done: r.done,
  }));
}

export async function markReviewDone(userId: string, reviewId: string): Promise<void> {
  await prisma.studyReview.updateMany({
    where: { id: reviewId, userId },
    data: { done: true, doneAt: new Date() },
  });
}

/** Repasos vencidos (para el cron): due <= ahora, sin enviar, sin hacer. */
export async function getDueReviews(): Promise<
  { id: string; userId: string; subject: string; title: string; interval: number }[]
> {
  const rows = await prisma.studyReview.findMany({
    where: { done: false, sent: false, dueDate: { lte: new Date() } },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    subject: r.subject,
    title: r.title,
    interval: r.interval,
  }));
}

export async function markReviewSent(reviewId: string): Promise<void> {
  await prisma.studyReview.update({ where: { id: reviewId }, data: { sent: true } }).catch(() => {});
}
