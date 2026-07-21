// Métricas de NEGOCIO agregadas para el panel de admin (centro de comando).
// Todo sale de Postgres vía Prisma. Zona horaria de referencia: Argentina.
//
// Concepto central "día activo de un usuario": un día en que el usuario
//   (a) abrió el dashboard web  → tabla user_active_days, O
//   (b) registró un movimiento  → transactions.createdAt (en TZ ARG).
// La unión de ambos es el mejor proxy de actividad. LIMITACIÓN conocida:
// user_active_days solo se escribe al abrir /dashboard, así que subcuenta a los
// usuarios que usan casi todo por WhatsApp. Se marca en el panel.

import { prisma } from "@/lib/prisma";

const ARG = "America/Argentina/Buenos_Aires";

// CTE reutilizable: (uid, day) de todos los días activos de cada usuario.
const ACTIVE_DAYS_CTE = `
  active_days AS (
    SELECT user_id AS uid, day FROM user_active_days
    UNION
    SELECT "userId" AS uid, ("createdAt" AT TIME ZONE '${ARG}')::date AS day FROM transactions
  )`;

function n(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  return Number(v ?? 0);
}

// ── Overview / salud ────────────────────────────────────────────────────────
export type Overview = {
  totalUsers: number;
  dau: number;
  wau: number;
  mau: number;
  stickiness: number; // DAU/MAU en %
  nsm: number; // North Star: activos semanales que registran movimientos
  activatedUsers: number; // con ≥1 movimiento histórico
  activationRate: number; // % del total
  signups7d: number;
  signupsPrev7d: number;
  signups30d: number;
  premiumActive: number;
};

export async function getOverview(): Promise<Overview> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    WITH ${ACTIVE_DAYS_CTE},
    today AS (SELECT (now() AT TIME ZONE '${ARG}')::date AS d)
    SELECT
      (SELECT count(*) FROM profiles) AS total_users,
      (SELECT count(DISTINCT uid) FROM active_days, today WHERE day = today.d) AS dau,
      (SELECT count(DISTINCT uid) FROM active_days, today WHERE day > today.d - 7) AS wau,
      (SELECT count(DISTINCT uid) FROM active_days, today WHERE day > today.d - 30) AS mau,
      (SELECT count(DISTINCT "userId") FROM transactions WHERE "createdAt" > now() - interval '7 days') AS nsm,
      (SELECT count(DISTINCT "userId") FROM transactions) AS activated,
      (SELECT count(*) FROM profiles WHERE "createdAt" > now() - interval '7 days') AS signups7,
      (SELECT count(*) FROM profiles WHERE "createdAt" > now() - interval '14 days' AND "createdAt" <= now() - interval '7 days') AS signups_prev7,
      (SELECT count(*) FROM profiles WHERE "createdAt" > now() - interval '30 days') AS signups30,
      (SELECT count(*) FROM profiles WHERE "premiumUntil" > now()) AS premium
  `);
  const r = rows[0] ?? {};
  const totalUsers = n(r.total_users);
  const dau = n(r.dau);
  const mau = n(r.mau);
  const activated = n(r.activated);
  return {
    totalUsers,
    dau,
    wau: n(r.wau),
    mau,
    stickiness: mau ? Math.round((dau / mau) * 100) : 0,
    nsm: n(r.nsm),
    activatedUsers: activated,
    activationRate: totalUsers ? Math.round((activated / totalUsers) * 100) : 0,
    signups7d: n(r.signups7),
    signupsPrev7d: n(r.signups_prev7),
    signups30d: n(r.signups30),
    premiumActive: n(r.premium),
  };
}

// ── Retención por cohorte (semanal) ─────────────────────────────────────────
export type CohortRow = {
  week: string; // ISO date del lunes de la cohorte
  size: number;
  // retention[offset] = % de la cohorte activo en la semana +offset (0..N)
  retention: (number | null)[];
};

export async function getCohortRetention(
  maxCohorts = 8,
  maxOffset = 6
): Promise<{ cohorts: CohortRow[]; maxOffset: number }> {
  const [sizes, cells, weekRow] = await Promise.all([
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT date_trunc('week', ("createdAt" AT TIME ZONE '${ARG}'))::date AS week, count(*) AS size
      FROM profiles GROUP BY 1 ORDER BY 1 DESC LIMIT ${maxCohorts}
    `),
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      WITH ${ACTIVE_DAYS_CTE},
      u AS (SELECT id, date_trunc('week', ("createdAt" AT TIME ZONE '${ARG}'))::date AS cohort_week FROM profiles),
      aw AS (SELECT DISTINCT uid, date_trunc('week', day)::date AS active_week FROM active_days)
      SELECT u.cohort_week AS week,
             ((aw.active_week - u.cohort_week) / 7)::int AS "offset",
             count(DISTINCT u.id) AS active
      FROM u JOIN aw ON aw.uid = u.id AND aw.active_week >= u.cohort_week
      GROUP BY u.cohort_week, "offset"
    `),
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT date_trunc('week', (now() AT TIME ZONE '${ARG}'))::date AS this_week`
    ),
  ]);

  const thisWeekMs = Date.parse(
    new Date(weekRow[0]?.this_week as string).toISOString().slice(0, 10)
  );

  const sizeByWeek = new Map<string, number>();
  for (const s of sizes) {
    const wk = new Date(s.week as string).toISOString().slice(0, 10);
    sizeByWeek.set(wk, n(s.size));
  }
  const activeByWeekOffset = new Map<string, number>();
  for (const c of cells) {
    const wk = new Date(c.week as string).toISOString().slice(0, 10);
    activeByWeekOffset.set(`${wk}:${n(c.offset)}`, n(c.active));
  }

  const cohorts: CohortRow[] = [...sizeByWeek.entries()].map(([week, size]) => {
    // Edad de la cohorte en semanas: hasta ahí la celda vacía = 0% (inactivo);
    // más allá = null (esa semana todavía no ocurrió).
    const ageWeeks = Math.round((thisWeekMs - Date.parse(week)) / (7 * 86_400_000));
    const retention: (number | null)[] = [];
    for (let o = 0; o <= maxOffset; o++) {
      if (o > ageWeeks) {
        retention.push(null);
        continue;
      }
      const active = activeByWeekOffset.get(`${week}:${o}`) ?? 0;
      retention.push(Math.round((active / size) * 100));
    }
    return { week, size, retention };
  });

  return { cohorts, maxOffset };
}

// ── Embudo AARRR ────────────────────────────────────────────────────────────
export type FunnelStep = { label: string; value: number; pctOfTop: number; dropFromPrev: number };

export async function getFunnel(): Promise<FunnelStep[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    WITH ${ACTIVE_DAYS_CTE}
    SELECT
      (SELECT count(*) FROM profiles) AS signups,
      (SELECT count(DISTINCT "userId") FROM transactions) AS activated,
      (SELECT count(DISTINCT p.id) FROM profiles p JOIN active_days a ON a.uid = p.id
         WHERE a.day > (p."createdAt" AT TIME ZONE '${ARG}')::date + 7) AS retained,
      (SELECT count(*) FROM profiles WHERE "premiumUntil" > now()) AS premium
  `);
  const r = rows[0] ?? {};
  const raw = [
    { label: "Registrados", value: n(r.signups) },
    { label: "Activados (1er movimiento)", value: n(r.activated) },
    { label: "Retenidos (activos +7d)", value: n(r.retained) },
    { label: "Premium", value: n(r.premium) },
  ];
  const top = raw[0].value || 1;
  return raw.map((step, i) => ({
    label: step.label,
    value: step.value,
    pctOfTop: Math.round((step.value / top) * 100),
    dropFromPrev:
      i === 0 || raw[i - 1].value === 0
        ? 0
        : Math.round((1 - step.value / raw[i - 1].value) * 100),
  }));
}

// ── Adopción de features ────────────────────────────────────────────────────
export type FeatureAdoption = { key: string; label: string; users: number; pct: number };

export async function getFeatureAdoption(): Promise<FeatureAdoption[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT
      (SELECT count(*) FROM profiles) AS total,
      (SELECT count(DISTINCT "userId") FROM transactions) AS tx,
      (SELECT count(*) FROM profiles WHERE "whatsappNumber" IS NOT NULL) AS wa,
      (SELECT count(*) FROM profiles WHERE "googleConnectedAt" IS NOT NULL) AS google,
      (SELECT count(*) FROM newsletter_configs WHERE "isActive" = true AND coalesce(array_length(topics,1),0) > 0) AS newsletter,
      (SELECT count(DISTINCT "userId") FROM budgets) AS budgets,
      (SELECT count(DISTINCT "userId") FROM goals) AS goals,
      (SELECT count(DISTINCT "userId") FROM recurring_transactions) AS recurring,
      (SELECT count(DISTINCT "userId") FROM investments) AS investments,
      (SELECT count(DISTINCT "userId") FROM debts) AS debts,
      (SELECT count(DISTINCT "userId") FROM tasks) AS tasks,
      (SELECT count(DISTINCT "userId") FROM push_subscriptions) AS push,
      (SELECT count(DISTINCT "userId") FROM grupos_gasto) AS groups
  `);
  const r = rows[0] ?? {};
  const total = n(r.total) || 1;
  const defs: [string, string][] = [
    ["tx", "Movimientos"],
    ["budgets", "Presupuestos"],
    ["goals", "Metas"],
    ["recurring", "Recurrentes"],
    ["wa", "Bot WhatsApp"],
    ["push", "Notificaciones"],
    ["newsletter", "Newsletter"],
    ["google", "Google Calendar"],
    ["investments", "Inversiones"],
    ["debts", "Deudas"],
    ["tasks", "Tareas"],
    ["groups", "Grupos"],
  ];
  return defs
    .map(([key, label]) => {
      const users = n(r[key]);
      return { key, label, users, pct: Math.round((users / total) * 100) };
    })
    .sort((a, b) => b.users - a.users);
}

// ── Churn / dormancia ("dónde se va la gente") ──────────────────────────────
export type Dormancy = {
  total: number;
  active7: number; // activo últimos 7 días
  dormant8_14: number;
  dormant15_30: number;
  dormant30plus: number;
  neverActivated: number; // registrado, sin actividad nunca
};

export async function getDormancy(): Promise<Dormancy> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    WITH ${ACTIVE_DAYS_CTE},
    last_active AS (SELECT uid, max(day) AS last_day FROM active_days GROUP BY uid),
    today AS (SELECT (now() AT TIME ZONE '${ARG}')::date AS d)
    SELECT
      (SELECT count(*) FROM profiles) AS total,
      (SELECT count(*) FROM last_active, today WHERE today.d - last_day <= 7) AS active7,
      (SELECT count(*) FROM last_active, today WHERE today.d - last_day BETWEEN 8 AND 14) AS d8_14,
      (SELECT count(*) FROM last_active, today WHERE today.d - last_day BETWEEN 15 AND 30) AS d15_30,
      (SELECT count(*) FROM last_active, today WHERE today.d - last_day > 30) AS d30,
      (SELECT count(*) FROM profiles p WHERE NOT EXISTS (SELECT 1 FROM last_active la WHERE la.uid = p.id)) AS never_active
  `);
  const r = rows[0] ?? {};
  return {
    total: n(r.total),
    active7: n(r.active7),
    dormant8_14: n(r.d8_14),
    dormant15_30: n(r.d15_30),
    dormant30plus: n(r.d30),
    neverActivated: n(r.never_active),
  };
}

// ── Monetización (estado actual; sin historial de pagos en la DB) ───────────
export type Monetization = {
  total: number;
  premiumActive: number;
  conversion: number; // % del total
  expiring7d: number;
  churnedPremium: number; // fueron premium y venció sin renovar
};

export async function getMonetization(): Promise<Monetization> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT
      (SELECT count(*) FROM profiles) AS total,
      (SELECT count(*) FROM profiles WHERE "premiumUntil" > now()) AS premium,
      (SELECT count(*) FROM profiles WHERE "premiumUntil" > now() AND "premiumUntil" <= now() + interval '7 days') AS expiring,
      (SELECT count(*) FROM profiles WHERE ("plan" = 'premium' OR "mpPreapprovalId" IS NOT NULL) AND ("premiumUntil" IS NULL OR "premiumUntil" <= now())) AS churned
  `);
  const r = rows[0] ?? {};
  const total = n(r.total);
  const premium = n(r.premium);
  return {
    total,
    premiumActive: premium,
    conversion: total ? Math.round((premium / total) * 1000) / 10 : 0,
    expiring7d: n(r.expiring),
    churnedPremium: n(r.churned),
  };
}

// ── Todo junto (una sola llamada para el panel) ─────────────────────────────
export type BusinessMetrics = {
  overview: Overview;
  funnel: FunnelStep[];
  cohorts: { cohorts: CohortRow[]; maxOffset: number };
  features: FeatureAdoption[];
  dormancy: Dormancy;
  monetization: Monetization;
};

export async function getBusinessMetrics(): Promise<BusinessMetrics> {
  const [overview, funnel, cohorts, features, dormancy, monetization] =
    await Promise.all([
      getOverview(),
      getFunnel(),
      getCohortRetention(),
      getFeatureAdoption(),
      getDormancy(),
      getMonetization(),
    ]);
  return { overview, funnel, cohorts, features, dormancy, monetization };
}
