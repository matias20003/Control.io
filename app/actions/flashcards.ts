"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isStudyOwner } from "@/lib/study/ingest";
import { generateFlashcards, listBlockFlashcards, gradeFlashcard } from "@/lib/study/flashcards";

async function requireOwner(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!(await isStudyOwner(user.id))) return null;
  return user.id;
}

export async function generateFlashcardsAction(blockId: string) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try {
    const r = await generateFlashcards(userId, blockId);
    if (!r.ok) return { error: r.error };
    const cards = await listBlockFlashcards(userId, blockId);
    revalidatePath("/estudio");
    return { success: true, cards };
  } catch {
    return { error: "No se pudieron generar las preguntas" };
  }
}

export async function getBlockFlashcardsAction(blockId: string) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  const cards = await listBlockFlashcards(userId, blockId);
  return { success: true, cards };
}

export async function gradeFlashcardAction(cardId: string, known: boolean) {
  const userId = await requireOwner();
  if (!userId) return { error: "No autorizado" };
  try {
    await gradeFlashcard(userId, cardId, known);
    return { success: true };
  } catch {
    return { error: "No se pudo guardar" };
  }
}
