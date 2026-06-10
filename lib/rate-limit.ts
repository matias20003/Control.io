import "server-only";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting para proteger endpoints sensibles (login, registro, OTP, reset)
 * de fuerza bruta y abuso.
 *
 * Doble estrategia:
 *  1. Si hay Upstash Redis configurado (UPSTASH_REDIS_REST_URL/TOKEN) → limitador
 *     distribuido con sliding window. Es lo correcto en producción serverless,
 *     donde cada lambda tiene su propia memoria.
 *  2. Si no → limitador en memoria (por instancia). Sirve en desarrollo y como
 *     red de seguridad básica, pero NO es confiable entre instancias en prod.
 *
 * Para activar el modo distribuido: crear una base en https://upstash.com
 * (gratis) y poner las 2 env vars. Sin nada configurado, igual hay protección
 * básica en memoria.
 */

export type RateLimitResult = { success: boolean; retryAfterSec: number };

// ─── Estrategia 1: Upstash (distribuido) ───
let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function getUpstashLimiter(limit: number, windowSec: number): Ratelimit | null {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  redis ??= Redis.fromEnv();
  const cacheKey = `${limit}:${windowSec}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: "rl",
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

// ─── Estrategia 2: memoria (fallback) ───
const memStore = new Map<string, { count: number; resetAt: number }>();

function memLimit(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || entry.resetAt <= now) {
    memStore.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { success: true, retryAfterSec: 0 };
  }
  entry.count++;
  if (entry.count > limit) {
    return { success: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { success: true, retryAfterSec: 0 };
}

// Limpieza ocasional de entradas viejas (evita que el Map crezca sin límite).
function sweepMemStore() {
  if (memStore.size < 5000) return;
  const now = Date.now();
  for (const [k, v] of memStore) if (v.resetAt <= now) memStore.delete(k);
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Aplica rate limiting para un `scope` (ej: "login") por IP del cliente.
 * Devuelve { success: false, retryAfterSec } cuando se excede el límite.
 */
export async function rateLimit(
  scope: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const ip = await getClientIp();
  const key = `${scope}:${ip}`;

  const upstash = getUpstashLimiter(limit, windowSec);
  if (upstash) {
    const res = await upstash.limit(key);
    return {
      success: res.success,
      retryAfterSec: res.success ? 0 : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    };
  }

  sweepMemStore();
  return memLimit(key, limit, windowSec);
}

/** Mensaje amigable para mostrar al usuario cuando se excede el límite. */
export function rateLimitMessage(retryAfterSec: number): string {
  const min = Math.ceil(retryAfterSec / 60);
  return min > 1
    ? `Demasiados intentos. Probá de nuevo en ${min} minutos.`
    : "Demasiados intentos. Esperá un minuto y probá de nuevo.";
}
