"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isStudyOwner } from "@/lib/study/ingest";
import {
  createSubject,
  createBlock,
  closeSession,
  updateBlockStatus,
  setAvailability,
  createExam,
  toggleExam,
  deleteExam,
  createExercise,
  toggleExercise,
  deleteExercise,
  reprogramarVencidos,
  createBlocksDistributed,
} from "@/lib/db/study-system";
import { MASTERY } from "@/lib/study/spaced";

async function requireOwner(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (!(await isStudyOwner(user.id))) return null;
  return user.id;
}

const subjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(12),
  type: z.enum(["anual", "cuatrimestral"]).optional(),
  color: z.string().trim().max(20).optional(),
});

export async function createSubjectAction(input: z.infer<typeof subjectSchema>) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const subject = await createSubject(userId, parsed.data);
    revalidatePath("/estudio");
    return { success: true, subject };
  } catch {
    return { error: "No se pudo crear la materia" };
  }
}

const blockSchema = z.object({
  subjectId: z.string().min(1),
  parcial: z.number().int().min(1).max(4),
  topic: z.string().trim().min(1).max(160),
  unit: z.string().trim().max(80).optional(),
  subtopic: z.string().trim().max(160).optional(),
  summary: z.string().trim().max(8000).optional(),
  source: z.string().trim().max(200).optional(),
  importance: z.number().int().min(1).max(4).optional(),
  difficulty: z.number().int().min(1).max(4).optional(),
});

export async function createBlockAction(input: z.infer<typeof blockSchema>) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const block = await createBlock(userId, parsed.data);
    revalidatePath("/estudio");
    return { success: true, block };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el bloque" };
  }
}

const closeSchema = z.object({
  blockId: z.string().min(1),
  result: z.enum(MASTERY as [string, ...string[]]),
  actualDuration: z.number().int().min(0).max(600).optional(),
  explainedWithoutNotes: z.boolean().optional(),
  solvedWithoutHelp: z.boolean().optional(),
  usedNotes: z.boolean().optional(),
  errorCategory: z.string().trim().max(60).optional(),
  errorDescription: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function closeSessionAction(input: z.infer<typeof closeSchema>) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const block = await closeSession(userId, {
      blockId: parsed.data.blockId,
      result: parsed.data.result as (typeof MASTERY)[number],
      actualDuration: parsed.data.actualDuration,
      explainedWithoutNotes: parsed.data.explainedWithoutNotes,
      solvedWithoutHelp: parsed.data.solvedWithoutHelp,
      usedNotes: parsed.data.usedNotes,
      errorCategory: parsed.data.errorCategory ?? null,
      errorDescription: parsed.data.errorDescription ?? null,
      notes: parsed.data.notes ?? null,
    });
    revalidatePath("/estudio");
    return { success: true, block };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cerrar la sesión" };
  }
}

export async function archiveBlockAction(blockId: string) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try {
    await updateBlockStatus(userId, blockId, "ARCHIVADO");
    revalidatePath("/estudio");
    return { success: true };
  } catch {
    return { error: "No se pudo archivar" };
  }
}

// ─────────── Disponibilidad ───────────
export async function setAvailabilityAction(dayOfWeek: number, minutes: number) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return { error: "Día inválido" };
  const m = Math.max(0, Math.min(1440, Math.round(minutes)));
  try {
    await setAvailability(userId, dayOfWeek, m);
    revalidatePath("/estudio");
    return { success: true };
  } catch {
    return { error: "No se pudo guardar la disponibilidad" };
  }
}

// ─────────── Parciales / objetivos ───────────
const examSchema = z.object({
  subjectId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  examDate: z.string().min(1), // ISO date (yyyy-mm-dd)
  importance: z.number().int().min(1).max(4).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function createExamAction(input: z.infer<typeof examSchema>) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const parsed = examSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const date = new Date(parsed.data.examDate + "T12:00:00");
  if (isNaN(date.getTime())) return { error: "Fecha inválida" };
  try {
    const exam = await createExam(userId, {
      subjectId: parsed.data.subjectId, title: parsed.data.title, examDate: date,
      importance: parsed.data.importance, notes: parsed.data.notes ?? null,
    });
    revalidatePath("/estudio");
    return { success: true, exam };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el parcial" };
  }
}

export async function toggleExamAction(id: string, done: boolean) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try { await toggleExam(userId, id, done); revalidatePath("/estudio"); return { success: true }; }
  catch { return { error: "No se pudo actualizar" }; }
}

export async function deleteExamAction(id: string) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try { await deleteExam(userId, id); revalidatePath("/estudio"); return { success: true }; }
  catch { return { error: "No se pudo eliminar" }; }
}

// ─────────── Ejercicios pendientes ───────────
const exerciseSchema = z.object({
  description: z.string().trim().min(1).max(500),
  blockId: z.string().optional(),
  subjectId: z.string().optional(),
  source: z.string().trim().max(200).optional(),
  dueDate: z.string().optional(),
});

export async function createExerciseAction(input: z.infer<typeof exerciseSchema>) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await createExercise(userId, {
      description: parsed.data.description,
      blockId: parsed.data.blockId || null,
      subjectId: parsed.data.subjectId || null,
      source: parsed.data.source ?? null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate + "T12:00:00") : null,
    });
    revalidatePath("/estudio");
    return { success: true };
  } catch {
    return { error: "No se pudo crear el ejercicio" };
  }
}

export async function toggleExerciseAction(id: string, done: boolean) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try { await toggleExercise(userId, id, done); revalidatePath("/estudio"); return { success: true }; }
  catch { return { error: "No se pudo actualizar" }; }
}

export async function deleteExerciseAction(id: string) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try { await deleteExercise(userId, id); revalidatePath("/estudio"); return { success: true }; }
  catch { return { error: "No se pudo eliminar" }; }
}

// ─────────── Resumen con IA para prellenar un bloque ───────────
export async function summarizeForBlockAction(input: { text: string; hintSubject?: string }) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const text = (input.text ?? "").trim();
  if (text.length < 30) return { error: "Pegá un poco más de texto para resumir" };
  try {
    const { summarizeStudyContent } = await import("@/lib/db/study");
    const r = await summarizeStudyContent(text.slice(0, 45000), input.hintSubject);
    return { success: true, topic: r.title, summary: r.summary };
  } catch {
    return { error: "No se pudo generar el resumen" };
  }
}

// ─────────── Analizar material → bloques propuestos (no guarda) ───────────
export async function analyzeMaterialAction(input: { text: string; hintSubject?: string }) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const text = (input.text ?? "").trim();
  if (text.length < 40) return { error: "Pegá un poco más de contenido para dividir en bloques" };
  try {
    const { analyzeTextToBlocks } = await import("@/lib/study/analyze");
    const result = await analyzeTextToBlocks(text.slice(0, 45000), input.hintSubject);
    if (!result.blocks.length) return { error: "No pude dividir el material. Probá con más texto o revisá que sea legible." };
    return { success: true, unit: result.unit, blocks: result.blocks };
  } catch {
    return { error: "No se pudo analizar el material" };
  }
}

// ─────────── Crear varios bloques de una carga (distribuidos en el calendario) ───────────
const bulkSchema = z.object({
  subjectId: z.string().min(1),
  parcial: z.number().int().min(1).max(4),
  blocks: z.array(z.object({
    topic: z.string().trim().min(1).max(160),
    unit: z.string().trim().max(80).nullish(),
    summary: z.string().max(6000).nullish(),
    prerequisites: z.string().trim().max(200).nullish(),
    difficulty: z.number().int().min(1).max(4).optional(),
    importance: z.number().int().min(1).max(4).optional(),
    estMinutes: z.number().int().min(5).max(120).optional(),
  })).min(1).max(20),
  source: z.string().trim().max(200).optional(),
});

export async function createBlocksBulkAction(input: z.infer<typeof bulkSchema>) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const created = await createBlocksDistributed(
      userId, parsed.data.subjectId, parsed.data.parcial,
      parsed.data.blocks.map((b) => ({ ...b, source: parsed.data.source ?? null })),
    );
    revalidatePath("/estudio");
    return { success: true, created };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudieron crear los bloques" };
  }
}

// ─────────── Reprogramación automática ───────────
export async function reprogramarAction() {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try {
    const n = await reprogramarVencidos(userId);
    revalidatePath("/estudio");
    return { success: true, reprogrammed: n };
  } catch {
    return { error: "No se pudo reprogramar" };
  }
}
