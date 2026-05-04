import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { LogoFull } from "@/components/layout/Logo";
import { MigrateButton } from "./MigrateButton";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin — control.io" };

/* ── helpers ── */
function statCard(label: string, value: string | number, sub?: string) {
  return { label, value: String(value), sub };
}

function pct(n: number, total: number) {
  if (!total) return "0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

/* ── data fetching ── */
async function getStats() {
  const now         = new Date();
  const d7          = new Date(now.getTime() - 7  * 86_400_000);
  const d30         = new Date(now.getTime() - 30 * 86_400_000);
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    newUsersWeek,
    newUsersMonth,
    totalTx,
    txThisMonth,
    txLast30,
    totalAccounts,
    totalGoals,
    totalInvestments,
    totalDebts,
    totalRecurring,
    // Daily registrations last 30 days (for sparkline)
    recentProfiles,
    // Active users: distinct userIds with a tx in last 30 days
    activeUserIds,
  ] = await Promise.all([
    prisma.profile.count(),
    prisma.profile.count({ where: { createdAt: { gte: d7  } } }),
    prisma.profile.count({ where: { createdAt: { gte: d30 } } }),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.transaction.count({ where: { createdAt: { gte: d30 } } }),
    prisma.account.count(),
    prisma.goal.count(),
    prisma.investment.count(),
    prisma.debt.count(),
    prisma.recurringTransaction.count({ where: { isActive: true } }),
    prisma.profile.findMany({
      where: { createdAt: { gte: d30 } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: d30 } },
    }),
  ]);

  const activeUsers = activeUserIds.length;

  // Build day-by-day registration count (last 30 days)
  const dayCounts: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(d30.getTime() + i * 86_400_000);
    dayCounts[d.toISOString().slice(0, 10)] = 0;
  }
  for (const p of recentProfiles) {
    const key = new Date(p.createdAt).toISOString().slice(0, 10);
    if (key in dayCounts) dayCounts[key]++;
  }
  const dailyRegistrations = Object.entries(dayCounts).map(([date, count]) => ({ date, count }));

  return {
    users: {
      total:      totalUsers,
      newWeek:    newUsersWeek,
      newMonth:   newUsersMonth,
      active:     activeUsers,
      activePct:  pct(activeUsers, totalUsers),
    },
    transactions: {
      total:      totalTx,
      thisMonth:  txThisMonth,
      last30:     txLast30,
      perActive:  activeUsers ? (txLast30 / activeUsers).toFixed(1) : "0",
    },
    entities: {
      accounts:  totalAccounts,
      goals:     totalGoals,
      investments: totalInvestments,
      debts:     totalDebts,
      recurring: totalRecurring,
    },
    dailyRegistrations,
  };
}

/* ── mini bar chart (server-rendered SVG) ── */
function MiniBarChart({ data }: { data: { date: string; count: number }[] }) {
  const max    = Math.max(...data.map((d) => d.count), 1);
  const W      = 560;
  const H      = 48;
  const barW   = Math.floor(W / data.length) - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12" aria-hidden>
      {data.map((d, i) => {
        const h = Math.max(2, Math.round((d.count / max) * H));
        return (
          <rect
            key={d.date}
            x={i * (barW + 1)}
            y={H - h}
            width={barW}
            height={h}
            rx={2}
            className={d.count > 0 ? "fill-primary/70" : "fill-border"}
          />
        );
      })}
    </svg>
  );
}

/* ── stat tile ── */
function Tile({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className={`text-2xl font-bold font-mono tabular-nums ${accent ?? "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

/* ── page ── */
export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  const s = await getStats();
  const now = new Date();
  const monthName = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-surface/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <LogoFull size="xs" />
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">Admin · {user.email}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-semibold text-success uppercase tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Live
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-10">

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Panel de administración</h1>
          <p className="text-sm text-muted">
            Métricas del sistema — actualizado {now.toLocaleString("es-AR")}
          </p>
        </div>

        {/* Users */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Usuarios</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="Total registrados"  value={s.users.total.toLocaleString("es-AR")} />
            <Tile label="Nuevos esta semana" value={s.users.newWeek.toLocaleString("es-AR")}  accent="text-primary" />
            <Tile label="Nuevos este mes"    value={s.users.newMonth.toLocaleString("es-AR")} accent="text-primary" />
            <Tile label="Activos últimos 30d" value={s.users.active.toLocaleString("es-AR")}
              sub={`${s.users.activePct} del total`} accent="text-success" />
          </div>
        </section>

        {/* Registrations chart */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Registros diarios — últimos 30 días
          </h2>
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <MiniBarChart data={s.dailyRegistrations} />
            <div className="flex justify-between text-[10px] text-muted">
              <span>hace 30 días</span>
              <span>hoy</span>
            </div>
          </div>
        </section>

        {/* Transactions */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Movimientos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="Total histórico"     value={s.transactions.total.toLocaleString("es-AR")} />
            <Tile label={`En ${monthName}`}   value={s.transactions.thisMonth.toLocaleString("es-AR")} accent="text-primary" />
            <Tile label="Últimos 30 días"     value={s.transactions.last30.toLocaleString("es-AR")} />
            <Tile label="Promedio por usuario activo" value={s.transactions.perActive}
              sub="movimientos / 30d" />
          </div>
        </section>

        {/* Entities */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Entidades creadas (total histórico)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Tile label="Cuentas"              value={s.entities.accounts.toLocaleString("es-AR")} />
            <Tile label="Metas"                value={s.entities.goals.toLocaleString("es-AR")} />
            <Tile label="Inversiones"          value={s.entities.investments.toLocaleString("es-AR")} />
            <Tile label="Deudas"               value={s.entities.debts.toLocaleString("es-AR")} />
            <Tile label="Recurrentes activos"  value={s.entities.recurring.toLocaleString("es-AR")} />
          </div>
        </section>

        {/* Encryption migration */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Herramientas de datos
          </h2>
          <div className="rounded-xl border border-border bg-surface p-5 flex items-start justify-between gap-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Migrar datos existentes a encriptación</p>
              <p className="text-xs text-muted max-w-md">
                Encripta las descripciones y notas de movimientos que aún están en texto plano
                (registros anteriores a la activación de AES-256-GCM). Seguro ejecutar múltiples veces.
              </p>
            </div>
            <MigrateButton />
          </div>
        </section>

      </main>
    </div>
  );
}
