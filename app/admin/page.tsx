import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { LogoFull } from "@/components/layout/Logo";
import { MigrateButton } from "./MigrateButton";
import { FixDoubleEncryptButton } from "./FixDoubleEncryptButton";
import { getAdminAnalytics } from "@/lib/db/admin-stats";
import { AdminAnalytics } from "./AdminAnalytics";
import { getResendDomainStatus } from "@/lib/email/domain-status";

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
    // Activación: distinct userIds con AL MENOS 1 transacción (cualquier fecha)
    activatedUserIds,
    // Waitlist: gente pre-registrada esperando acceso
    waitlistTotal,
    waitlistWeek,
    waitlistByProfile,
    // Push: cuántos tienen notificaciones activas
    pushSubsCount,
    // WhatsApp: usuarios con número vinculado + mensajes procesados este mes
    usersWithWhatsapp,
    waRows,
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
    prisma.transaction.groupBy({
      by: ["userId"],
    }),
    // Waitlist puede fallar si la tabla aún no migró. Lo tolerable.
    prisma.waitlistEntry.count().catch(() => 0),
    prisma.waitlistEntry.count({ where: { createdAt: { gte: d7 } } }).catch(() => 0),
    prisma.waitlistEntry.groupBy({ by: ["profile"], _count: true }).catch(() => []),
    prisma.pushSubscription.count().catch(() => 0),
    prisma.profile.count({ where: { whatsappNumber: { not: null } } }).catch(() => 0),
    prisma
      .$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "whatsapp_processed_messages" WHERE created_at >= ${monthStart}`
      .catch(() => [{ n: 0 }]),
  ]);

  const waMessages = waRows[0]?.n ?? 0;
  const waEstimated = waMessages * 2; // entrante + respuesta (aprox)
  const waLimit = 2000;
  const waPercent = Math.min(Math.round((waEstimated / waLimit) * 100), 100);

  const activeUsers = activeUserIds.length;
  const activatedUsers = activatedUserIds.length;

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
      total:        totalUsers,
      newWeek:      newUsersWeek,
      newMonth:     newUsersMonth,
      active:       activeUsers,
      activePct:    pct(activeUsers, totalUsers),
      activated:    activatedUsers,
      activatedPct: pct(activatedUsers, totalUsers),
      pushOn:       pushSubsCount,
      withWhatsapp: usersWithWhatsapp,
    },
    whatsapp: {
      messages:  waMessages,
      estimated: waEstimated,
      limit:     waLimit,
      percent:   waPercent,
    },
    waitlist: {
      total:     waitlistTotal,
      newWeek:   waitlistWeek,
      byProfile: waitlistByProfile as Array<{ profile: string; _count: number }>,
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

const PROFILE_LABELS: Record<string, string> = {
  organize:   "Organizar gastos",
  save_goals: "Ahorrar para metas",
  invest:     "Inversiones",
  other:      "Otro",
};

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

  const [s, analytics, domainStatus] = await Promise.all([
    getStats(),
    getAdminAnalytics(),
    getResendDomainStatus(),
  ]);
  const feedback = await prisma.feedback
    .findMany({ orderBy: { createdAt: "desc" }, take: 50 })
    .catch(() => []);
  const now = new Date();
  const monthName = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const waAccent = s.whatsapp.percent >= 80 ? "text-danger" : s.whatsapp.percent >= 60 ? "text-warning" : "text-success";
  const waBar = s.whatsapp.percent >= 80 ? "bg-danger" : s.whatsapp.percent >= 60 ? "bg-warning" : "bg-success";

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

        {/* Analítica avanzada: evolución, embudo, conectados, reactivación */}
        <AdminAnalytics data={analytics} domainStatus={domainStatus} gmailReady={!!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)} />

        {/* Feedback de testers — lo primero del beta */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Feedback de testers ({feedback.length})
          </h2>
          {feedback.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
              Todavía no hay feedback. Aparece acá apenas un tester use el botón “Feedback”.
            </p>
          ) : (
            <div className="space-y-2.5">
              {feedback.map((f) => (
                <div key={f.id} className="rounded-xl border border-border bg-surface p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{f.message}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                    <span>{f.email ?? "anónimo"}</span>
                    {f.page && <span>· {f.page}</span>}
                    <span>· {new Date(f.createdAt).toLocaleString("es-AR")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Waitlist — primera sección porque es lo que se llena ahora */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Lista de espera (/waitlist)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="Anotados total" value={s.waitlist.total.toLocaleString("es-AR")} accent="text-primary" />
            <Tile label="Esta semana"    value={s.waitlist.newWeek.toLocaleString("es-AR")}  accent="text-primary" />
          </div>

          {s.waitlist.byProfile.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
                Distribución por interés
              </p>
              {s.waitlist.byProfile.map((p) => {
                const pctOfTotal = s.waitlist.total ? (p._count / s.waitlist.total) * 100 : 0;
                return (
                  <div key={p.profile} className="flex items-center gap-3 text-sm">
                    <span className="w-40 text-muted truncate">
                      {PROFILE_LABELS[p.profile] ?? p.profile}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pctOfTotal}%` }} />
                    </div>
                    <span className="w-16 text-right font-mono tabular-nums text-foreground">
                      {p._count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Users */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Usuarios registrados</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="Total registrados"  value={s.users.total.toLocaleString("es-AR")} />
            <Tile label="Nuevos esta semana" value={s.users.newWeek.toLocaleString("es-AR")}  accent="text-primary" />
            <Tile label="Nuevos este mes"    value={s.users.newMonth.toLocaleString("es-AR")} accent="text-primary" />
            <Tile label="Activos últimos 30d" value={s.users.active.toLocaleString("es-AR")}
              sub={`${s.users.activePct} del total`} accent="text-success" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile
              label="Activación"
              value={s.users.activatedPct}
              sub={`${s.users.activated}/${s.users.total} cargaron al menos 1 movimiento`}
              accent={s.users.activated > 0 ? "text-success" : "text-muted"}
            />
            <Tile
              label="Push activadas"
              value={s.users.pushOn.toLocaleString("es-AR")}
              sub={`${pct(s.users.pushOn, s.users.total)} del total`}
            />
          </div>
        </section>

        {/* Bot de WhatsApp */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Bot de WhatsApp — {monthName}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="Usuarios con WhatsApp" value={s.users.withWhatsapp.toLocaleString("es-AR")} accent="text-primary" />
            <Tile label="Mensajes entrantes (mes)" value={s.whatsapp.messages.toLocaleString("es-AR")} />
            <Tile label="Estimado total (in+out)" value={`${s.whatsapp.estimated.toLocaleString("es-AR")} / ${s.whatsapp.limit}`} accent={waAccent} />
            <Tile label="Uso del plan" value={`${s.whatsapp.percent}%`} accent={waAccent} />
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
            <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
              <div className={`h-full ${waBar} transition-all`} style={{ width: `${s.whatsapp.percent}%` }} />
            </div>
            <p className="text-xs text-muted">
              Plan gratis de Kapso: {s.whatsapp.limit} mensajes/mes (todos los usuarios juntos). El número exacto está en el panel de Kapso.
              {s.whatsapp.percent >= 80 ? " ⚠️ Cerca del límite del plan." : ""}
            </p>
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
            <Tile label="Gastos fijos activos"  value={s.entities.recurring.toLocaleString("es-AR")} />
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
          <div className="rounded-xl border border-border bg-surface p-5 flex items-start justify-between gap-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Reparar gastos fijos doble-encriptados</p>
              <p className="text-xs text-muted max-w-md">
                Corrige los movimientos generados por el cron de gastos fijos que quedaron
                doble-encriptados y mostraban «enc:…» en la lista. Seguro ejecutar múltiples veces.
              </p>
            </div>
            <FixDoubleEncryptButton />
          </div>
        </section>

      </main>
    </div>
  );
}
