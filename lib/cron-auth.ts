import crypto from "node:crypto";

/**
 * Compara el header Authorization con `Bearer <secret>` en tiempo constante,
 * para no filtrar el secreto por timing. Devuelve false si el header es null,
 * de distinta longitud, o no coincide.
 */
export function bearerMatches(authHeader: string | null | undefined, secret: string): boolean {
  const a = Buffer.from(authHeader ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
