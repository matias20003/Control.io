// ─── Feature flags ───────────────────────────────────────────────────────────
// Permite "deployar" una feature sin que la vean todos todavía:
//   "off"     → nadie la ve (apagada).
//   "testers" → solo cuentas con isTester=true (vos, para verificar).
//   "all"     → todos los usuarios.
//
// Flujo: la armo en "testers" → push (solo vos la ves) → la verificás →
// cambiás acá a "all" → push → la ven todos. Un solo lugar, sin re-deploy
// riesgoso ni tocar la lógica de la feature.

export type Rollout = "off" | "testers" | "all";

export type FeatureFlag =
  | "gastosHormiga"
  | "finDeMes"
  | "tareas"
  | "recordatorios"
  | "premium"
  | "onboardingWa";

export const FEATURE_FLAGS: Record<FeatureFlag, Rollout> = {
  gastosHormiga: "testers", // detector de gastos hormiga / suscripciones
  finDeMes: "testers",      // proyección "¿llego a fin de mes?"
  tareas: "all",            // tareas / pendientes (app + bot) — para todos
  recordatorios: "all",     // recordatorios con hora (disparo vía QStash) — para todos
  premium: "testers",       // paywall + suscripción MercadoPago
  onboardingWa: "testers",  // hero de onboarding WhatsApp-first
};

/** ¿Este usuario puede ver la feature? */
export function hasFeature(flag: FeatureFlag, opts: { isTester: boolean }): boolean {
  const state = FEATURE_FLAGS[flag];
  if (state === "all") return true;
  if (state === "testers") return opts.isTester;
  return false;
}
