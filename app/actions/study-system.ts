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
  postponeBlock,
  postponeTodayForward,
  deleteBlocks,
  setAvailability,
  createExam,
  toggleExam,
  deleteExam,
  createExercise,
  toggleExercise,
  deleteExercise,
  reprogramarVencidos,
  balanceUpcoming,
  createBlocksDistributed,
  createUnit,
  renameUnit,
  deleteUnit,
  setSubjectGroupLabel,
  archiveAllBlocks,
} from "@/lib/db/study-system";
import { createFocusNote } from "@/lib/db/study";
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

/** Guarda una nota del Modo Enfoque ("vaciar la cabeza"). Aparece en Apuntes. */
export async function saveFocusNoteAction(input: { subject: string; topic: string; text: string }) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const text = (input.text ?? "").trim();
  if (!text) return { error: "Nota vacía" };
  try {
    await createFocusNote(userId, {
      subject: (input.subject || "Enfoque").slice(0, 40),
      title: `Enfoque · ${(input.topic || "").slice(0, 100)}`,
      text: text.slice(0, 4000),
    });
    revalidatePath("/estudio");
    return { success: true };
  } catch {
    return { error: "No se pudo guardar la nota" };
  }
}

/**
 * Guarda UNA nota rápida del enfoque (Enter = una nota), vinculada al bloque.
 * Devuelve la nota creada para mostrarla al toque en la caja de notas.
 */
export async function addFocusNoteAction(input: { subjectCode: string; blockCode: string; topic: string; text: string }) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const text = (input.text ?? "").trim();
  if (!text) return { error: "Nota vacía" };
  try {
    const r = await createFocusNote(userId, {
      subject: (input.subjectCode || "Enfoque").slice(0, 40),
      title: `${(input.blockCode || "").slice(0, 20)} · ${(input.topic || "").slice(0, 80)}`.replace(/^ · /, "").trim() || "Nota",
      text: text.slice(0, 4000),
    });
    revalidatePath("/estudio");
    return { success: true, id: r.id };
  } catch {
    return { error: "No se pudo guardar la nota" };
  }
}

const subjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(12),
  type: z.enum(["anual", "cuatrimestral"]).optional(),
  color: z.string().trim().max(20).optional(),
  groupLabel: z.string().trim().max(20).optional(),
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
  unitId: z.string().trim().max(40).nullish(),
  subtopic: z.string().trim().max(160).optional(),
  summary: z.string().trim().max(8000).optional(),
  source: z.string().trim().max(200).optional(),
  importance: z.number().int().min(1).max(4).optional(),
  difficulty: z.number().int().min(1).max(4).optional(),
  initialSessions: z.number().int().min(1).max(6).optional(),
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

// ── Unidades / Capítulos ──
const unitSchema = z.object({
  subjectId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
});

export async function createUnitAction(input: z.infer<typeof unitSchema>) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const parsed = unitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const unit = await createUnit(userId, parsed.data);
    revalidatePath("/estudio");
    return { success: true, unit };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear la unidad" };
  }
}

export async function renameUnitAction(unitId: string, name: string) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  if (!name.trim()) return { error: "Nombre vacío" };
  try {
    await renameUnit(userId, unitId, name);
    revalidatePath("/estudio");
    return { success: true };
  } catch {
    return { error: "No se pudo renombrar" };
  }
}

export async function deleteUnitAction(unitId: string) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try {
    await deleteUnit(userId, unitId);
    revalidatePath("/estudio");
    return { success: true };
  } catch {
    return { error: "No se pudo eliminar la unidad" };
  }
}

export async function setGroupLabelAction(subjectId: string, label: string) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try {
    await setSubjectGroupLabel(userId, subjectId, label);
    revalidatePath("/estudio");
    return { success: true };
  } catch {
    return { error: "No se pudo guardar" };
  }
}

/** "Empezar limpio": archiva todos los bloques (o los de una materia). Conserva el historial. */
export async function archiveAllBlocksAction(subjectId?: string) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try {
    const count = await archiveAllBlocks(userId, subjectId);
    revalidatePath("/estudio");
    return { success: true, count };
  } catch {
    return { error: "No se pudo archivar" };
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

export async function postponeTodayAction() {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try {
    const moved = await postponeTodayForward(userId);
    revalidatePath("/estudio");
    return { success: true, moved };
  } catch {
    return { error: "No se pudo reacomodar" };
  }
}

export async function postponeBlockAction(blockId: string) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try {
    const block = await postponeBlock(userId, blockId);
    if (!block) return { error: "Bloque no encontrado" };
    revalidatePath("/estudio");
    return { success: true, block };
  } catch {
    return { error: "No se pudo posponer" };
  }
}

export async function deleteBlocksAction(ids: string[]) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  if (!Array.isArray(ids) || !ids.length) return { error: "Nada seleccionado" };
  try {
    const deleted = await deleteBlocks(userId, ids.slice(0, 500));
    revalidatePath("/estudio");
    return { success: true, deleted };
  } catch {
    return { error: "No se pudieron eliminar" };
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
    // Reacomoda los repasos futuros a la nueva disponibilidad: si un día quedó
    // sobrecargado, empuja el sobrante al próximo día hábil. Nunca adelanta ni
    // reordena lo que ya entraba bien.
    const moved = await balanceUpcoming(userId).catch(() => 0);
    revalidatePath("/estudio");
    return { success: true, moved };
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

// ─────────── Subida grande vía Storage (evita el límite de 4.5MB de Vercel) ───────────
const STUDY_BUCKET = "study-uploads";
const NOTEBOOK_PAGES_PER_RUN = 6;

export async function createStudyUploadUrlAction() {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const crypto = await import("node:crypto");
  const admin = createAdminClient();
  const path = `${userId}/${crypto.randomUUID()}`;
  const { data, error } = await admin.storage.from(STUDY_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "No pude preparar la subida" };
  return { success: true, bucket: STUDY_BUCKET, path: data.path, token: data.token };
}

const analyzeUpSchema = z.object({
  files: z.array(z.object({ path: z.string().min(1), type: z.string().default("") })).max(20).optional(),
  text: z.string().max(45000).optional(),
  subjectId: z.string().optional(),
  hintSubject: z.string().optional(),
  notebook: z.boolean().optional(),
  fromPage: z.number().int().min(1).optional(),
  skip: z.boolean().optional(),
  keep: z.boolean().optional(), // no borrar el archivo (para leer el PDF por tandas)
});

/** Borra archivos subidos (tras leer un PDF completo por tandas). */
export async function cleanupStudyUploadsAction(paths: string[]) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const safe = (paths ?? []).filter((p) => p.startsWith(`${userId}/`));
  if (!safe.length) return { success: true };
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient().storage.from(STUDY_BUCKET).remove(safe).catch(() => {});
  return { success: true };
}

export async function analyzeUploadedAction(input: z.infer<typeof analyzeUpSchema>) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const parsed = analyzeUpSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };
  const { files = [], text, subjectId, hintSubject, notebook, fromPage, skip, keep } = parsed.data;

  // Seguridad: cada path debe pertenecer al usuario.
  for (const f of files) if (!f.path.startsWith(`${userId}/`)) return { error: "Ruta inválida" };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const cleanup = async () => { if (!keep && files.length) await admin.storage.from(STUDY_BUCKET).remove(files.map((f) => f.path)).catch(() => {}); };
  const download = async (p: string): Promise<Buffer> => {
    const { data, error } = await admin.storage.from(STUDY_BUCKET).download(p);
    if (error || !data) throw new Error("No pude leer el archivo subido");
    return Buffer.from(await data.arrayBuffer());
  };

  try {
    const { analyzeTextToBlocks, analyzeImagesToBlocks } = await import("@/lib/study/analyze");

    // ── MODO CUADERNO: PDF completo, solo páginas nuevas ──
    if (notebook && subjectId && files.length) {
      const { prisma } = await import("@/lib/prisma");
      const { pdfPageCount, renderPdfPages } = await import("@/lib/study/pdfpages");
      const subject = await prisma.studySubject.findFirst({ where: { id: subjectId, userId }, select: { id: true, code: true, notebookPages: true } });
      if (!subject) return { error: "Materia no encontrada" };
      const buf = await download(files[0].path);
      let total: number;
      try { total = await pdfPageCount(buf); } catch { return { error: "No pude abrir el PDF" }; }

      if (skip) {
        await prisma.studySubject.update({ where: { id: subject.id }, data: { notebookPages: total } });
        return { success: true, notebook: { skipped: true, total } };
      }
      const manualFrom = typeof fromPage === "number" ? fromPage - 1 : null;
      const from = manualFrom != null ? Math.min(manualFrom, total) : Math.min(subject.notebookPages, total);
      if (from >= total) return { success: true, notebook: { noNew: true, total }, blocks: [] };
      const to = Math.min(from + NOTEBOOK_PAGES_PER_RUN, total);
      const dataUrls = await renderPdfPages(buf, from, to);
      const r = await analyzeImagesToBlocks(dataUrls, subject.code);
      // manual = rango elegido a mano (no toca el puntero del cuaderno; sirve
      // para procesar cualquier PDF/anotado sin romper el "solo lo nuevo").
      return { success: true, unit: r.unit, blocks: r.blocks, notebook: { from, to, total, remaining: total - to, subjectId: subject.id, manual: manualFrom != null } };
    }

    if (files.length) {
      const images = files.filter((f) => (f.type || "").startsWith("image/"));
      if (images.length) {
        const dataUrls = await Promise.all(images.map(async (f) => `data:${f.type};base64,${(await download(f.path)).toString("base64")}`));
        const r = await analyzeImagesToBlocks(dataUrls, hintSubject);
        if (!r.blocks.length) return { error: "No pude leer las imágenes. Probá con fotos más nítidas." };
        return { success: true, unit: r.unit, blocks: r.blocks };
      }
      const { extractPdfText } = await import("@/lib/study/ingest");
      const buf = await download(files[0].path);
      const pdfText = await extractPdfText(buf).catch(() => "");
      if (pdfText.trim().length >= 40) {
        const r = await analyzeTextToBlocks(pdfText, hintSubject);
        if (!r.blocks.length) return { error: "No pude dividir el PDF." };
        return { success: true, unit: r.unit, blocks: r.blocks };
      }
      return { error: "Ese PDF es manuscrito (imagen). Tildá “cuaderno” o subí las hojas como imágenes 📸" };
    }

    if ((text ?? "").trim().length >= 40) {
      const r = await analyzeTextToBlocks(text!.trim(), hintSubject);
      if (!r.blocks.length) return { error: "No pude dividir el material." };
      return { success: true, unit: r.unit, blocks: r.blocks };
    }
    return { error: "Subí el material o pegá el texto." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error procesando el material" };
  } finally {
    await cleanup();
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
  // avance del puntero del cuaderno (modo "solo lo nuevo")
  notebookTo: z.number().int().min(0).optional(),
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
    // Avanzar el puntero del cuaderno solo si aumenta (no retroceder).
    if (typeof parsed.data.notebookTo === "number") {
      const { advanceNotebookPointer } = await import("@/lib/db/study-system");
      await advanceNotebookPointer(userId, parsed.data.subjectId, parsed.data.notebookTo);
    }
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
    const balanced = await balanceUpcoming(userId);
    revalidatePath("/estudio");
    return { success: true, reprogrammed: n + balanced };
  } catch {
    return { error: "No se pudo reprogramar" };
  }
}

// ─────────── Notion (importar) ───────────
export async function connectNotionAction(input: { token: string; dbId: string }) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const token = (input.token ?? "").trim();
  if (!/^(secret_|ntn_)/.test(token) || token.length < 20) return { error: "Ese no parece un token de integración de Notion (empieza con secret_ o ntn_)" };
  const { normalizeNotionDbId, setNotionConfig, readNotionProposals } = await import("@/lib/study/notion");
  const dbId = normalizeNotionDbId((input.dbId ?? "").trim());
  if (!dbId) return { error: "No pude leer el ID de la base. Pegá la URL o el ID de la base de datos de Notion." };
  try {
    await setNotionConfig(userId, token, dbId);
    // prueba de conexión inmediata
    const test = await readNotionProposals(userId);
    if (!test.ok) return { error: test.error ?? "No pude leer la base" };
    revalidatePath("/estudio");
    return { success: true, count: test.proposals.length };
  } catch {
    return { error: "No se pudo conectar con Notion" };
  }
}

export async function importFromNotionAction(input: { subjectId: string; parcial: number }) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  if (!input.subjectId) return { error: "Elegí la materia destino" };
  const parcial = Math.max(1, Math.min(4, Math.round(input.parcial)));
  try {
    const { importFromNotion } = await import("@/lib/study/notion");
    const r = await importFromNotion(userId, input.subjectId, parcial);
    if (!r.ok) return { error: r.error ?? "No se pudo importar" };
    revalidatePath("/estudio");
    return { success: true, imported: r.imported };
  } catch {
    return { error: "No se pudo importar de Notion" };
  }
}

export async function disconnectNotionAction() {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const { disconnectNotion } = await import("@/lib/study/notion");
  await disconnectNotion(userId);
  revalidatePath("/estudio");
  return { success: true };
}

// ─────────── Google Calendar (importar / ver) ───────────
export async function connectGcalAction(input: { url: string }) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const url = (input.url ?? "").trim();
  if (!/^https:\/\/.+/.test(url) || !/(ical|\.ics|calendar\.google)/i.test(url)) {
    return { error: "Pegá la URL secreta en formato iCal de Google (termina en .ics)" };
  }
  try {
    const { setGcalUrl, fetchUpcomingEvents } = await import("@/lib/study/gcal");
    await setGcalUrl(userId, url);
    const test = await fetchUpcomingEvents(userId, 21);
    if (!test.ok) return { error: test.error ?? "No pude leer el calendario" };
    revalidatePath("/estudio");
    return { success: true, count: test.events.length };
  } catch {
    return { error: "No se pudo conectar el calendario" };
  }
}

export async function disconnectGcalAction() {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const { disconnectGcal } = await import("@/lib/study/gcal");
  await disconnectGcal(userId);
  revalidatePath("/estudio");
  return { success: true };
}

export async function getCalendarEventsAction(daysAhead = 21) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const { fetchUpcomingEvents } = await import("@/lib/study/gcal");
  const r = await fetchUpcomingEvents(userId, daysAhead);
  if (!r.ok) return { error: r.error ?? "No pude leer el calendario" };
  return { success: true, events: r.events.map((e) => ({ title: e.title, start: e.start.toISOString(), allDay: e.allDay })) };
}

export async function importCalendarExamsAction() {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try {
    const { importDetectedExams } = await import("@/lib/study/gcal");
    const r = await importDetectedExams(userId);
    revalidatePath("/estudio");
    return { success: true, imported: r.imported, unmatched: r.unmatched };
  } catch {
    return { error: "No se pudieron importar los parciales" };
  }
}

// ─────────── Calendario ICS ───────────
export async function getIcsUrlAction() {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const { getOrCreateIcsToken } = await import("@/lib/study/notion");
  const token = await getOrCreateIcsToken(userId);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://controlio.site";
  return { success: true, url: `${base}/api/estudio/calendar?t=${token}` };
}

// ─────────── Aviso diario (hora + on/off) ───────────
const notifySchema = z.object({
  planHour: z.number().int().min(0).max(23),
  planMinute: z.number().int().min(0).max(59),
  notifyEnabled: z.boolean(),
});

export async function setStudyNotifyAction(input: z.infer<typeof notifySchema>) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const parsed = notifySchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };
  try {
    const { setStudySettings } = await import("@/lib/study/notify");
    await setStudySettings(userId, parsed.data);
    revalidatePath("/estudio");
    return { success: true };
  } catch {
    return { error: "No se pudo guardar" };
  }
}
