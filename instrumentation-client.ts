import * as Sentry from "@sentry/nextjs";

/**
 * Monitoreo de errores en el navegador (Sentry).
 *
 * El DSN del cliente DEBE ser NEXT_PUBLIC_ (se expone al browser).
 * No-op si no está configurado. No activamos Session Replay porque ya
 * usamos PostHog para eso — evitamos duplicar peso en el cliente.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
  });
}

// Vincula los errores con la navegación (en qué pantalla ocurrió).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
