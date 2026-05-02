import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_LENGTH = 10;

// Crockford-ish base32, sin chars ambiguos (I, L, O, 0, 1)
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars

function generateRecoveryCode(): string {
  const bytes = crypto.randomBytes(RECOVERY_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

/**
 * Replaces all existing recovery codes for the user with a fresh batch.
 * Returns the plaintext codes — these are shown to the user ONCE and never persisted plaintext.
 */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
  const hashes = codes.map(hashRecoveryCode);

  await prisma.$transaction(async (tx) => {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.createMany({
      data: hashes.map((codeHash) => ({ userId, codeHash })),
    });
  });

  return codes;
}

/**
 * Consumes a recovery code if valid and unused. Returns true on success.
 * Atomic: uses updateMany with consumedAt:null guard so a race can't double-consume.
 */
export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const codeHash = hashRecoveryCode(code);
  const result = await prisma.mfaRecoveryCode.updateMany({
    where: { userId, codeHash, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return result.count > 0;
}

export async function countUnusedRecoveryCodes(userId: string): Promise<number> {
  return prisma.mfaRecoveryCode.count({
    where: { userId, consumedAt: null },
  });
}
