/**
 * AES-256-GCM field-level encryption for sensitive personal data.
 *
 * All encrypted values are prefixed with "enc:" so we can detect them
 * and stay backward-compatible with existing plaintext rows during migration.
 *
 * Key: 32-byte random value stored as ENCRYPTION_KEY (64-char hex) in env vars.
 * Never commit this key to git.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX    = "enc:";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(raw, "hex");
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns null if input is null or empty.
 * Returns an "enc:<base64url>" string on success.
 */
export function encrypt(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  const key = getKey();
  const iv  = randomBytes(12);                          // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const body   = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();                   // 16-byte auth tag
  // Layout: [iv(12) | tag(16) | ciphertext]
  return PREFIX + Buffer.concat([iv, tag, body]).toString("base64url");
}

/**
 * Decrypts a value previously produced by encrypt().
 * If the value doesn't start with "enc:", it's assumed to be plaintext
 * (pre-migration row) and is returned as-is — so existing data keeps working.
 * Returns null if input is null or empty.
 */
export function decrypt(encoded: string | null | undefined): string | null {
  if (!encoded) return encoded ?? null;
  if (!encoded.startsWith(PREFIX)) return encoded; // plaintext (pre-migration)
  try {
    const key = getKey();
    const buf  = Buffer.from(encoded.slice(PREFIX.length), "base64url");
    if (buf.length < 29) return null; // too short to be valid
    const iv         = buf.subarray(0, 12);
    const tag        = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher   = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  } catch {
    // Authentication failed or corrupted — return null rather than garbage
    return null;
  }
}

/** Returns true if the value was produced by encrypt(). */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}
