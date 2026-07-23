// Panel de administración: vista de usuarios y análisis por usuario.
// PRIVACIDAD: exponemos SOLO comportamiento (actividad, features usadas, dónde
// se traba) y datos de cuenta (email/nombre, visibles para el dueño). NUNCA
// contenido financiero (montos, descripciones, notas) — esos quedan cifrados y
// no se leen acá.

import { prisma } from "@/lib/prisma";
import { getOnboardingState, type OnboardingState } from "@/lib/db/onboarding";
import { getStreakInfo } from "@/lib/db/streak";

const ARG = "America/Argentina/Buenos_Aires";

function n(v: unknown): number {
  return typeof v === "bigint" ? Number(v) : Number(v ?? 0);
}
function iso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export type UserStatus = "nuevo" | "activo" | "dormido" | "perdido" | "nunca";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  plan: string;
  isPremium: boolean;
  whatsapp: boolean;
  tester: boolean;
  tx: number;
  lastActive: string | null;
  daysSinceActive: number | null;
  status: UserStatus;
};

function statusOf(createdAt: string, lastActive: string | null, tx: number): { status: UserStatus; daysSinceActive: number | null } {
  const now = Date.now();
  if (tx === 0 && !lastActive) {
    const ageDays = Math.floor((now - Date.parse(createdAt)) / 86_400_000);
    return { status: ageDays <= 3 ? "nuevo" : "nunca", daysSinceActive: null };
  }
  const last = lastActive ? Date.parse(lastActive) : Date.parse(createdAt);
  const days = Math.floor((now - last) / 86_400_000);
  if (days <= 7) return { status: "activo", daysSinceActive: days };
  if (days <= 30) return { status: "dormido", daysSinceActive: days };
  return { status: "perdido", daysSinceActive: days };
}

export async function getUsersOverview(): Promise<UserRow[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    WITH active AS (
      SELECT user_id AS uid, day FROM user_active_days
      UNION
      SELECT "userId", ("createdAt" AT TIME ZONE '${ARG}')::date FROM transactions
    ),
    la AS (SELECT uid, max(day) AS last_day FROM active GROUP BY uid),
    tx AS (SELECT "userId" AS uid, count(*) AS n FROM transactions GROUP BY "userId")
    SELECT p.id, p.email, p.name, p."createdAt", p.plan,
           (p."premiumUntil" > now()) AS premium,
           (p."whatsappNumber" IS NOT NULL) AS wa,
           p."isTester" AS tester,
           coalesce(tx.n, 0) AS tx,
           la.last_day
    FROM profiles p
    LEFT JOIN tx ON tx.uid = p.id
    LEFT JOIN la ON la.uid = p.id
    ORDER BY p."createdAt" DESC
  `);

  return rows.map((r) => {
    const createdAt = iso(r.createdAt)!;
    const lastActive = r.last_day ? iso(r.last_day) : null;
    const tx = n(r.tx);
    const { status, daysSinceActive } = statusOf(createdAt, lastActive, tx);
    return {
      id: String(r.id),
      email: String(r.email),
      name: (r.name as string) ?? null,
      createdAt,
      plan: String(r.plan ?? "free"),
      isPremium: !!r.premium,
      whatsapp: !!r.wa,
      tester: !!r.tester,
      tx,
      lastActive,
      daysSinceActive,
      status,
    };
  });
}

// ── Detalle por usuario ─────────────────────────────────────────────────────
export type FeatureUse = { key: string; label: string; count: number; used: boolean };

export type UserDetail = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  plan: string;
  isPremium: boolean;
  premiumUntil: string | null;
  whatsapp: boolean;
  google: boolean;
  tester: boolean;
  status: UserStatus;
  daysSinceActive: number | null;
  activation: { activated: boolean; firstTxAt: string | null; daysToActivate: number | null };
  activity: { firstActive: string | null; lastActive: string | null; activeDaysTotal: number; activeDays30: number };
  engagement: { txTotal: number; tx30: number; streakCurrent: number; streakLongest: number; weekly: { week: string; count: number }[] };
  onboarding: OnboardingState;
  features: FeatureUse[];
  signals: { tone: "danger" | "warning" | "info"; text: string }[];
};

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const profile = await prisma.profile.findUnique({ where: { id: userId } });
  if (!profile) return null;

  const [agg, weeklyRows, onboarding, streak] = await Promise.all([
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      WITH active AS (
        SELECT day FROM user_active_days WHERE user_id = $1
        UNION
        SELECT ("createdAt" AT TIME ZONE '${ARG}')::date FROM transactions WHERE "userId" = $1
      )
      SELECT
        (SELECT count(*) FROM transactions WHERE "userId"=$1) AS tx_total,
        (SELECT count(*) FROM transactions WHERE "userId"=$1 AND "createdAt" > now()-interval '30 days') AS tx_30,
        (SELECT min("createdAt") FROM transactions WHERE "userId"=$1) AS first_tx,
        (SELECT min(day) FROM active) AS first_active,
        (SELECT max(day) FROM active) AS last_active,
        (SELECT count(*) FROM active) AS active_total,
        (SELECT count(*) FROM active, (SELECT (now() AT TIME ZONE '${ARG}')::date d) t WHERE day > t.d - 30) AS active_30,
        (SELECT count(*) FROM accounts WHERE "userId"=$1) AS accounts,
        (SELECT count(*) FROM budgets WHERE "userId"=$1) AS budgets,
        (SELECT count(*) FROM goals WHERE "userId"=$1) AS goals,
        (SELECT count(*) FROM investments WHERE "userId"=$1) AS investments,
        (SELECT count(*) FROM debts WHERE "userId"=$1) AS debts,
        (SELECT count(*) FROM recurring_transactions WHERE "userId"=$1) AS recurring,
        (SELECT count(*) FROM tasks WHERE "userId"=$1) AS tasks,
        (SELECT count(*) FROM push_subscriptions WHERE "userId"=$1) AS push,
        (SELECT count(*) FROM grupos_gasto WHERE "userId"=$1) AS groups,
        (SELECT count(*) FROM newsletter_configs WHERE "userId"=$1 AND "isActive"=true AND coalesce(array_length(topics,1),0)>0) AS newsletter
    `, userId),
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT date_trunc('week', ("createdAt" AT TIME ZONE '${ARG}'))::date AS week, count(*) AS n
      FROM transactions WHERE "userId"=$1 AND "createdAt" > now()-interval '56 days'
      GROUP BY 1 ORDER BY 1
    `, userId),
    getOnboardingState(userId).catch(() => null),
    getStreakInfo(userId).catch(() => ({ current: 0, longest: 0 })),
  ]);

  const a = agg[0] ?? {};
  const createdAt = profile.createdAt.toISOString();
  const lastActive = a.last_active ? iso(a.last_active) : null;
  const firstTxAt = iso(a.first_tx);
  const txTotal = n(a.tx_total);
  const { status, daysSinceActive } = statusOf(createdAt, lastActive, txTotal);

  const daysToActivate = firstTxAt
    ? Math.max(0, Math.round((Date.parse(firstTxAt) - Date.parse(createdAt)) / 86_400_000))
    : null;

  const features: FeatureUse[] = [
    { key: "accounts", label: "Cuentas", count: n(a.accounts) },
    { key: "tx", label: "Movimientos", count: txTotal },
    { key: "budgets", label: "Presupuestos", count: n(a.budgets) },
    { key: "goals", label: "Metas", count: n(a.goals) },
    { key: "recurring", label: "Recurrentes", count: n(a.recurring) },
    { key: "investments", label: "Inversiones", count: n(a.investments) },
    { key: "debts", label: "Deudas", count: n(a.debts) },
    { key: "tasks", label: "Tareas", count: n(a.tasks) },
    { key: "groups", label: "Grupos", count: n(a.groups) },
    { key: "newsletter", label: "Newsletter", count: n(a.newsletter) },
    { key: "push", label: "Notificaciones", count: n(a.push) },
  ].map((f) => ({ ...f, used: f.count > 0 }));

  // Señales de "dónde se traba" — derivadas, sin datos sensibles.
  const signals: UserDetail["signals"] = [];
  if (txTotal === 0) signals.push({ tone: "danger", text: "Nunca cargó un movimiento: se traba en la activación." });
  if (n(a.accounts) === 0) signals.push({ tone: "warning", text: "No creó ninguna cuenta." });
  if (onboarding && !onboarding.hasTransaction && onboarding.completedCount > 0)
    signals.push({ tone: "warning", text: `Empezó el onboarding (${onboarding.completedCount}/5) pero no llegó a cargar su 1er movimiento.` });
  if (status === "dormido") signals.push({ tone: "warning", text: `Dormido hace ${daysSinceActive} días.` });
  if (status === "perdido") signals.push({ tone: "danger", text: `Sin actividad hace ${daysSinceActive} días — probable abandono.` });
  const featuresUsed = features.filter((f) => f.used && f.key !== "accounts").length;
  if (txTotal > 0 && featuresUsed <= 1) signals.push({ tone: "info", text: "Usa muy pocas features: oportunidad de activar presupuestos/metas." });
  if (n(a.push) === 0) signals.push({ tone: "info", text: "Sin notificaciones activadas: cuesta traerlo de vuelta." });
  if (!signals.length) signals.push({ tone: "info", text: "Sin señales de fricción: usuario sano." });

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    createdAt,
    plan: profile.plan,
    isPremium: !!profile.premiumUntil && profile.premiumUntil > new Date(),
    premiumUntil: profile.premiumUntil ? profile.premiumUntil.toISOString() : null,
    whatsapp: !!profile.whatsappNumber,
    google: !!profile.googleConnectedAt,
    tester: profile.isTester,
    status,
    daysSinceActive,
    activation: { activated: txTotal > 0, firstTxAt, daysToActivate },
    activity: {
      firstActive: iso(a.first_active),
      lastActive,
      activeDaysTotal: n(a.active_total),
      activeDays30: n(a.active_30),
    },
    engagement: {
      txTotal,
      tx30: n(a.tx_30),
      streakCurrent: streak.current,
      streakLongest: streak.longest,
      weekly: weeklyRows.map((w) => ({ week: iso(w.week)!.slice(0, 10), count: n(w.n) })),
    },
    onboarding: onboarding ?? { hasAccount: false, hasWhatsapp: false, hasCustomCategory: false, hasTransaction: false, hasPushSubscription: false, completedCount: 0, totalSteps: 5, isComplete: false },
    features,
    signals,
  };
}
