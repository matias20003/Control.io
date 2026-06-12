import { prisma } from "@/lib/prisma";
import { getReactivationCandidates } from "@/lib/reactivation";

// Analítica avanzada para el panel de admin: series históricas, embudo de
// activación, usuarios conectados y estado de reactivación.

export type DailyPoint = { date: string; registros: number; activos: number; movimientos: number };
export type FunnelStep = { label: string; value: number };
export type ConnectedUser = {
  name: string | null;
  email: string;
  whatsapp: boolean;
  lastActivity: string | null;
  movs: number;
  movs7: number;
};
export type ReactSent = { name: string | null; email: string; sentAt: string };
export type ReactPending = { name: string | null; email: string; dormant: boolean };

export type AdminAnalytics = {
  daily: DailyPoint[];
  funnel: FunnelStep[];
  connected: ConnectedUser[];
  reactivation: { sentCount: number; sent: ReactSent[]; pending: ReactPending[] };
  whatsappAvg: { conWa: number; sinWa: number };
};

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const DAYS = 45;

  const [txDaily, regDaily, funnelRow, connectedRows, sentRows, pendingCandidates, waAvgRows] =
    await Promise.all([
      prisma.$queryRaw<{ d: string; movs: number; activos: number }[]>`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') d,
          count(*)::int movs, count(DISTINCT "userId")::int activos
        FROM transactions WHERE "createdAt" >= now() - interval '45 days'
        GROUP BY 1`,
      prisma.$queryRaw<{ d: string; regs: number }[]>`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') d, count(*)::int regs
        FROM profiles WHERE "createdAt" >= now() - interval '45 days' GROUP BY 1`,
      prisma.$queryRaw<{ registered: number; account: number; whatsapp: number; category: number; movement: number }[]>`
        SELECT count(*)::int registered,
          count(*) FILTER (WHERE (SELECT count(*) FROM accounts a WHERE a."userId"=p.id) > 3)::int account,
          count(*) FILTER (WHERE p."whatsappNumber" IS NOT NULL)::int whatsapp,
          count(*) FILTER (WHERE (SELECT count(*) FROM categories c WHERE c."userId"=p.id) > 16)::int category,
          count(*) FILTER (WHERE EXISTS(SELECT 1 FROM transactions t WHERE t."userId"=p.id))::int movement
        FROM profiles p`,
      prisma.$queryRaw<{ name: string | null; email: string; wa: boolean; last_activity: Date | null; movs: number; movs7: number }[]>`
        SELECT p.name, p.email, (p."whatsappNumber" IS NOT NULL) wa,
          max(t."createdAt") last_activity, count(t.id)::int movs,
          count(t.id) FILTER (WHERE t."createdAt" >= now() - interval '7 days')::int movs7
        FROM profiles p LEFT JOIN transactions t ON t."userId"=p.id
        GROUP BY p.id, p.name, p.email, wa
        ORDER BY max(t."createdAt") DESC NULLS LAST
        LIMIT 40`,
      prisma.$queryRaw<{ name: string | null; email: string; sent: Date }[]>`
        SELECT name, email, "reactivationNudgeAt" sent FROM profiles
        WHERE "reactivationNudgeAt" IS NOT NULL ORDER BY "reactivationNudgeAt" DESC LIMIT 50`,
      getReactivationCandidates(),
      prisma.$queryRaw<{ wa: boolean; avg: number }[]>`
        SELECT (p."whatsappNumber" IS NOT NULL) wa,
          round(avg((SELECT count(*) FROM transactions t WHERE t."userId"=p.id)), 1)::float avg
        FROM profiles p GROUP BY 1`,
    ]);

  // Serie diaria continua (rellena días sin datos con 0).
  const txMap = new Map(txDaily.map((r) => [r.d, r]));
  const regMap = new Map(regDaily.map((r) => [r.d, r.regs]));
  const daily: DailyPoint[] = [];
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const tx = txMap.get(d);
    daily.push({
      date: d,
      registros: regMap.get(d) ?? 0,
      activos: tx?.activos ?? 0,
      movimientos: tx?.movs ?? 0,
    });
  }

  const f = funnelRow[0] ?? { registered: 0, account: 0, whatsapp: 0, category: 0, movement: 0 };
  const funnel: FunnelStep[] = [
    { label: "Registrados", value: f.registered },
    { label: "Cuenta propia", value: f.account },
    { label: "WhatsApp", value: f.whatsapp },
    { label: "Categoría propia", value: f.category },
    { label: "1er movimiento", value: f.movement },
  ];

  const connected: ConnectedUser[] = connectedRows.map((r) => ({
    name: r.name,
    email: r.email,
    whatsapp: r.wa,
    lastActivity: r.last_activity ? r.last_activity.toISOString() : null,
    movs: r.movs,
    movs7: r.movs7,
  }));

  const conWa = waAvgRows.find((r) => r.wa)?.avg ?? 0;
  const sinWa = waAvgRows.find((r) => !r.wa)?.avg ?? 0;

  return {
    daily,
    funnel,
    connected,
    reactivation: {
      sentCount: sentRows.length,
      sent: sentRows.map((r) => ({ name: r.name, email: r.email, sentAt: r.sent.toISOString() })),
      pending: pendingCandidates.map((c) => ({ name: c.name, email: c.email, dormant: c.dormant })),
    },
    whatsappAvg: { conWa, sinWa },
  };
}
