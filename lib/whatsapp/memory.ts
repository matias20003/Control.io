/**
 * Memoria del asistente de WhatsApp:
 * - Historial de conversación (corto plazo): para que recuerde el hilo.
 * - Notas del usuario (largo plazo): datos durables que el agente guarda.
 */
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Últimos N turnos de conversación, en orden cronológico. Contenido desencriptado. */
export async function getChatHistory(userId: string, limit = 12): Promise<ChatTurn[]> {
  const rows = await prisma.$queryRaw<{ role: string; content: string }[]>`
    SELECT role, content FROM "whatsapp_chat_history"
    WHERE user_id = ${userId} ORDER BY id DESC LIMIT ${limit}`;
  return rows
    .reverse()
    .map((r) => ({
      role: r.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: decrypt(r.content) ?? "",
    }));
}

/** Guarda el turno (mensaje del usuario + respuesta) encriptado, y poda el historial viejo. */
export async function saveChatTurn(userId: string, userMsg: string, assistantMsg: string): Promise<void> {
  try {
    const u = encrypt(userMsg.slice(0, 2000));
    const a = encrypt(assistantMsg.slice(0, 2000));
    await prisma.$executeRaw`INSERT INTO "whatsapp_chat_history" (user_id, role, content) VALUES (${userId}, 'user', ${u})`;
    await prisma.$executeRaw`INSERT INTO "whatsapp_chat_history" (user_id, role, content) VALUES (${userId}, 'assistant', ${a})`;
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

/** Notas/datos durables del usuario (desencriptados). */
export async function getMemory(userId: string, limit = 30): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ fact: string }[]>`
    SELECT fact FROM "whatsapp_memory" WHERE user_id = ${userId} ORDER BY id DESC LIMIT ${limit}`;
  return rows
    .map((r) => decrypt(r.fact) ?? "")
    .filter(Boolean)
    .reverse();
}

export async function addMemory(userId: string, fact: string): Promise<void> {
  const clean = fact.trim().slice(0, 500);
  if (!clean) return;
  const enc = encrypt(clean);
  await prisma.$executeRaw`INSERT INTO "whatsapp_memory" (user_id, fact) VALUES (${userId}, ${enc})`;
}

/** Borra toda la memoria conversacional durable y el historial del usuario. */
export async function clearAssistantMemory(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "whatsapp_memory" WHERE user_id = ${userId}`,
    prisma.$executeRaw`DELETE FROM "whatsapp_chat_history" WHERE user_id = ${userId}`,
    prisma.$executeRaw`DELETE FROM "whatsapp_agent_rules" WHERE user_id = ${userId}`,
    prisma.$executeRaw`DELETE FROM "whatsapp_pending_actions" WHERE user_id = ${userId}`,
  ]);
}
