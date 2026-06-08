/**
 * Memoria del asistente de WhatsApp:
 * - Historial de conversación (corto plazo): para que recuerde el hilo.
 * - Notas del usuario (largo plazo): datos durables que el agente guarda.
 */
import { prisma } from "@/lib/prisma";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Últimos N turnos de conversación, en orden cronológico. */
export async function getChatHistory(userId: string, limit = 12): Promise<ChatTurn[]> {
  const rows = await prisma.$queryRaw<{ role: string; content: string }[]>`
    SELECT role, content FROM "whatsapp_chat_history"
    WHERE user_id = ${userId} ORDER BY id DESC LIMIT ${limit}`;
  return rows
    .reverse()
    .map((r) => ({ role: r.role === "assistant" ? "assistant" : "user", content: r.content }));
}

/** Guarda el turno (mensaje del usuario + respuesta) y poda el historial viejo. */
export async function saveChatTurn(userId: string, userMsg: string, assistantMsg: string): Promise<void> {
  try {
    await prisma.$executeRaw`INSERT INTO "whatsapp_chat_history" (user_id, role, content) VALUES (${userId}, 'user', ${userMsg.slice(0, 2000)})`;
    await prisma.$executeRaw`INSERT INTO "whatsapp_chat_history" (user_id, role, content) VALUES (${userId}, 'assistant', ${assistantMsg.slice(0, 2000)})`;
    // Mantener solo los últimos 40 turnos por usuario.
    await prisma.$executeRaw`
      DELETE FROM "whatsapp_chat_history"
      WHERE user_id = ${userId}
        AND id NOT IN (
          SELECT id FROM "whatsapp_chat_history" WHERE user_id = ${userId} ORDER BY id DESC LIMIT 40
        )`;
  } catch {
    // la memoria no debe romper el flujo principal
  }
}

/** Notas/datos durables del usuario. */
export async function getMemory(userId: string, limit = 30): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ fact: string }[]>`
    SELECT fact FROM "whatsapp_memory" WHERE user_id = ${userId} ORDER BY id DESC LIMIT ${limit}`;
  return rows.map((r) => r.fact).reverse();
}

export async function addMemory(userId: string, fact: string): Promise<void> {
  const clean = fact.trim().slice(0, 500);
  if (!clean) return;
  await prisma.$executeRaw`INSERT INTO "whatsapp_memory" (user_id, fact) VALUES (${userId}, ${clean})`;
}
