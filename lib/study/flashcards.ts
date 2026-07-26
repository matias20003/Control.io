import "server-only";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

// Leitner: días hasta el próximo repaso según la "caja" (0 = recién/falló).
const BOX_DAYS = [0, 1, 3, 7, 16, 35];

export type FlashcardDTO = { id: string; question: string; answer: string; box: number };

function inDays(days: number): Date {
  const d = new Date(Date.now() + days * 86_400_000);
  if (days === 0) return new Date(Date.now() + 3 * 60_000); // falló → en 3 min
  d.setHours(12, 0, 0, 0);
  return d;
}

/**
 * Genera flashcards con Gemini USANDO EXCLUSIVAMENTE el resumen del tema
 * (que salió del material del usuario). Prohibido inventar. Devuelve cuántas creó.
 */
export async function generateFlashcards(userId: string, blockId: string): Promise<{ ok: boolean; error?: string; created: number }> {
  const block = await prisma.studyBlock.findFirst({ where: { id: blockId, userId }, select: { id: true, topic: true, summary: true } });
  if (!block) return { ok: false, error: "Tema no encontrado", created: 0 };
  const material = (decrypt(block.summary) ?? "").trim();
  if (material.length < 40) return { ok: false, error: "Este tema no tiene apunte/material cargado. Agregá el resumen (editá el tema) y volvé a generar.", created: 0 };

  const system =
    `Sos un generador de tarjetas de estudio (flashcards) para recuperación activa. ` +
    `Generá preguntas y respuestas USANDO EXCLUSIVAMENTE el CONTENIDO que te paso abajo. ` +
    `REGLA ESTRICTA: NO inventes NADA que no esté en el contenido. No agregues datos externos. ` +
    `Si el contenido es escaso, generá MENOS tarjetas (está perfecto). Cubrí definiciones, ` +
    `conceptos clave, fórmulas y procedimientos que SÍ aparezcan. Pregunta clara y corta; ` +
    `respuesta breve y correcta según el contenido. Máximo 12 tarjetas. ` +
    `MATEMÁTICA: escribí TODA fórmula/símbolo en LaTeX entre signos $ — inline como $x^2$ y en ` +
    `bloque como $$\\int_a^b f(x)\\,dx$$. Usá comandos LaTeX (\\int, \\sum, \\lim, \\frac, \\Delta, ` +
    `subíndices _{} y superíndices ^{}). NO uses texto plano para la matemática. ` +
    `Respondé SOLO JSON: {"cards":[{"q":"pregunta","a":"respuesta"}]}. Tema: ${block.topic}.`;

  let cards: { q: string; a: string }[] = [];
  try {
    const { studyGenerate } = await import("@/lib/ai/generate");
    const txt = await studyGenerate({ system, userText: "CONTENIDO:\n" + material.slice(0, 20000), json: true }) || "{}";
    const parsed = JSON.parse(txt) as { cards?: { q?: string; a?: string }[] };
    cards = (parsed.cards ?? [])
      .map((c) => ({ q: (c.q ?? "").toString().trim().slice(0, 500), a: (c.a ?? "").toString().trim().slice(0, 1000) }))
      .filter((c) => c.q && c.a)
      .slice(0, 12);
  } catch (e) {
    const msg = e instanceof Error && /429/.test(e.message) ? "La IA está sin cupo ahora. Probá en unos minutos." : "No se pudieron generar las preguntas";
    return { ok: false, error: msg, created: 0 };
  }
  if (!cards.length) return { ok: false, error: "No pude extraer preguntas de este material. Probá con un resumen más completo.", created: 0 };

  // Reemplaza las flashcards previas de este tema (regenerar limpio).
  await prisma.studyFlashcard.deleteMany({ where: { userId, blockId } });
  await prisma.studyFlashcard.createMany({
    data: cards.map((c) => ({ userId, blockId, question: c.q, answer: encrypt(c.a) ?? c.a })),
  });
  return { ok: true, created: cards.length };
}

export async function listBlockFlashcards(userId: string, blockId: string): Promise<FlashcardDTO[]> {
  const rows = await prisma.studyFlashcard.findMany({ where: { userId, blockId }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ id: r.id, question: r.question, answer: decrypt(r.answer) ?? "", box: r.box }));
}

/** Cuenta de flashcards por bloque (para mostrar en la lista de temas). */
export async function flashcardCounts(userId: string): Promise<Record<string, number>> {
  const rows = await prisma.studyFlashcard.groupBy({ by: ["blockId"], where: { userId }, _count: { _all: true } });
  const map: Record<string, number> = {};
  for (const r of rows) map[r.blockId] = r._count._all;
  return map;
}

/** Califica una tarjeta: si la sabía sube de caja (más espaciada); si no, vuelve a 0. */
export async function gradeFlashcard(userId: string, cardId: string, known: boolean): Promise<void> {
  const card = await prisma.studyFlashcard.findFirst({ where: { id: cardId, userId }, select: { box: true } });
  if (!card) return;
  const nextBox = known ? Math.min(5, card.box + 1) : 0;
  await prisma.studyFlashcard.updateMany({
    where: { id: cardId, userId },
    data: { box: nextBox, nextReview: inDays(BOX_DAYS[nextBox]), reviews: { increment: 1 } },
  });
}

/** Tarjetas que vencen hoy (para "preguntas del día"), con su tema. */
export async function listDueFlashcards(userId: string, limit = 40): Promise<(FlashcardDTO & { blockId: string; topic: string; subjectCode: string })[]> {
  const now = new Date();
  const [cards, blocks, subjects] = await Promise.all([
    prisma.studyFlashcard.findMany({ where: { userId, nextReview: { lte: now } }, orderBy: { nextReview: "asc" }, take: limit }),
    prisma.studyBlock.findMany({ where: { userId }, select: { id: true, topic: true, subjectId: true } }),
    prisma.studySubject.findMany({ where: { userId }, select: { id: true, code: true } }),
  ]);
  const bMap = new Map(blocks.map((b) => [b.id, b]));
  const sMap = new Map(subjects.map((s) => [s.id, s.code]));
  return cards.map((r) => {
    const b = bMap.get(r.blockId);
    return { id: r.id, question: r.question, answer: decrypt(r.answer) ?? "", box: r.box, blockId: r.blockId, topic: b?.topic ?? "", subjectCode: b ? sMap.get(b.subjectId) ?? "?" : "?" };
  });
}
