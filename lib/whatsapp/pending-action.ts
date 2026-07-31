import "server-only";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

export type StoredPendingAction = {
  actions: unknown[];
  answer: string;
};

const TTL_MINUTES = 15;

export async function savePendingAction(userId: string, value: StoredPendingAction): Promise<void> {
  const payload = encrypt(JSON.stringify(value));
  await prisma.$executeRaw`DELETE FROM "whatsapp_pending_actions" WHERE user_id = ${userId}`;
  await prisma.$executeRaw`
    INSERT INTO "whatsapp_pending_actions" (user_id, payload, expires_at)
    VALUES (${userId}, ${payload}, NOW() + (${TTL_MINUTES} * INTERVAL '1 minute'))`;
}

export async function takePendingAction(userId: string): Promise<StoredPendingAction | null> {
  const rows = await prisma.$queryRaw<{ id: bigint; payload: string }[]>`
    SELECT id, payload FROM "whatsapp_pending_actions"
    WHERE user_id = ${userId} AND expires_at > NOW()
    ORDER BY id DESC LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  await prisma.$executeRaw`DELETE FROM "whatsapp_pending_actions" WHERE user_id = ${userId}`;
  try {
    return JSON.parse(decrypt(row.payload) ?? "") as StoredPendingAction;
  } catch {
    return null;
  }
}

export async function hasPendingAction(userId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ found: boolean }[]>`
    SELECT EXISTS(
      SELECT 1 FROM "whatsapp_pending_actions"
      WHERE user_id = ${userId} AND expires_at > NOW()
    ) AS found`;
  return !!rows[0]?.found;
}

export async function cancelPendingAction(userId: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "whatsapp_pending_actions" WHERE user_id = ${userId}`;
}
