import * as Sentry from "@sentry/nextjs";

/**
 * Monitoreo de errores en el servidor (Sentry).
 *
 * Runtime-only: NO usamos el plugin de build de Sentry (withSentryConfig)
 * porque choca con Turbopack en Next 16. Esto captura errores en runtime,
 * que es el 90% del valor (enterarse cuando algo se rompe en producción).
 *
 * No-op si no hay SENTRY_DSN → seguro de deployar sin configurar nada.
 * Para activarlo: crear un proyecto en sentry.io y poner el DSN en las env vars.
 */
export function register() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    // Solo enviamos en producción para no ensuciar con errores de desarrollo.
    enabled: process.env.NODE_ENV === "production",
    // 10% de las transacciones para performance — suficiente para detectar
    // lentitud sin disparar el costo.
    tracesSampleRate: 0.1,
  });
}

// Captura errores de Server Components, Route Handlers y Server Actions.
// Si Sentry no se inicializó (sin DSN), es un no-op.
export const onRequestError = Sentry.captureRequestError;
