// Centro de comando del negocio: hero de salud (North Star), embudo AARRR,
// retención por cohortes, adopción de features, churn/dormancia y monetización.
// Server component (todo estático); los datos vienen de lib/db/business-metrics.

import {
  Target,
  TrendingUp,
  TrendingDown,
  Info,
  Users,
  Repeat,
  Crown,
} from "lucide-react";
import type {
  BusinessMetrics,
  Overview,
  FunnelStep,
  CohortRow,
  FeatureAdoption,
  Dormancy,
  Monetization,
} from "@/lib/db/business-metrics";

function fmt(n: number): string {
  return n.toLocaleString("es-AR");
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
        {children}
      </h2>
      {hint && <span className="text-[11px] text-muted/70">{hint}</span>}
    </div>
  );
}

// ── Hero de salud ────────────────────────────────────────────────────────────
function HealthHero({ o, mon }: { o: Overview; mon: Monetization }) {
  const signupDelta =
    o.signupsPrev7d === 0
      ? o.signups7d > 0
        ? 100
        : 0
      : Math.round(((o.signups7d - o.signupsPrev7d) / o.signupsPrev7d) * 100);

  const secondary = [
    { label: "Activos semanales", value: fmt(o.wau), sub: "WAU · abrieron o cargaron" },
    { label: "Activos mensuales", value: fmt(o.mau), sub: "MAU" },
    {
      label: "Stickiness",
      value: `${o.stickiness}%`,
      sub: "DAU/MAU · >20% es bueno",
      accent: o.stickiness >= 20 ? "text-success" : "text-warning",
    },
    {
      label: "Activación",
      value: `${o.activationRate}%`,
      sub: `${fmt(o.activatedUsers)}/${fmt(o.totalUsers)} cargó 1 movimiento`,
      accent: o.activationRate >= 40 ? "text-success" : "text-warning",
    },
    {
      label: "Premium",
      value: fmt(mon.premiumActive),
      sub: `${mon.conversion}% de conversión`,
      accent: mon.premiumActive > 0 ? "text-primary" : "text-muted",
    },
  ];

  return (
    <section className="space-y-3">
      <SectionTitle hint="la métrica madre: si esto crece, la app está sana">
        Salud del negocio
      </SectionTitle>
      <div className="grid gap-3 lg:grid-cols-3">
        {/* North Star */}
        <div className="lg:row-span-1 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5">
          <div className="flex items-center gap-2 text-primary">
            <Target size={15} />
            <p className="text-[10px] font-semibold uppercase tracking-widest">
              North Star
            </p>
          </div>
          <p className="mt-3 font-mono text-5xl font-bold tabular-nums text-foreground">
            {fmt(o.nsm)}
          </p>
          <p className="mt-1.5 text-sm font-medium text-foreground">
            Usuarios activos que registran su plata
          </p>
          <p className="text-xs text-muted">esta semana · el hábito que crea el valor</p>
        </div>

        {/* Secundarias */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted">Nuevos 7d</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
              {fmt(o.signups7d)}
            </p>
            <p
              className={`mt-0.5 inline-flex items-center gap-1 text-xs font-medium ${
                signupDelta >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {signupDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {signupDelta >= 0 ? "+" : ""}
              {signupDelta}% vs semana previa
            </p>
          </div>
          {secondary.map((t) => (
            <div key={t.label} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted">{t.label}</p>
              <p
                className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                  t.accent ?? "text-foreground"
                }`}
              >
                {t.value}
              </p>
              <p className="mt-0.5 text-xs text-muted leading-snug">{t.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Embudo AARRR ─────────────────────────────────────────────────────────────
function FunnelSection({ funnel }: { funnel: FunnelStep[] }) {
  return (
    <section className="space-y-3">
      <SectionTitle hint="dónde se fuga la gente en el camino al hábito">
        Embudo de conversión
      </SectionTitle>
      <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
        {funnel.map((step, i) => (
          <div key={step.label}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-sm text-foreground">{step.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                  {fmt(step.value)}
                </span>
                <span className="text-[11px] text-muted w-10 text-right">
                  {step.pctOfTop}%
                </span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(step.pctOfTop, 1.5)}%` }}
              />
            </div>
            {i > 0 && step.dropFromPrev > 0 && (
              <p className="mt-1 text-[11px] text-danger/80">
                ↓ se pierde {step.dropFromPrev}% respecto al paso anterior
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Retención por cohortes ───────────────────────────────────────────────────
function cohortCell(pct: number | null): { cls: string; text: string } {
  if (pct == null) return { cls: "bg-transparent text-transparent", text: "" };
  let cls = "bg-surface-2 text-muted";
  if (pct > 0 && pct <= 15) cls = "bg-success/10 text-foreground/80";
  else if (pct <= 30) cls = "bg-success/20 text-foreground/90";
  else if (pct <= 50) cls = "bg-success/35 text-foreground";
  else if (pct <= 75) cls = "bg-success/55 text-white";
  else if (pct > 75) cls = "bg-success/75 text-white";
  return { cls, text: `${pct}%` };
}

function shortWeek(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function CohortSection({ data }: { data: { cohorts: CohortRow[]; maxOffset: number } }) {
  const { cohorts, maxOffset } = data;
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);

  return (
    <section className="space-y-3">
      <SectionTitle hint="% de cada camada que sigue activa · una buena app aplana la curva">
        Retención por cohorte (semanal)
      </SectionTitle>
      <div className="rounded-xl border border-border bg-surface p-4 overflow-x-auto">
        {cohorts.length === 0 ? (
          <p className="text-sm text-muted">Sin datos suficientes todavía.</p>
        ) : (
          <table className="w-full border-separate border-spacing-1 text-center">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted px-1">
                  Camada
                </th>
                <th className="text-[10px] font-semibold uppercase tracking-wider text-muted px-1">
                  Users
                </th>
                {offsets.map((o) => (
                  <th
                    key={o}
                    className="text-[10px] font-semibold uppercase tracking-wider text-muted px-1 min-w-[42px]"
                  >
                    S{o}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.week}>
                  <td className="text-left text-xs text-foreground font-medium whitespace-nowrap px-1">
                    {shortWeek(c.week)}
                  </td>
                  <td className="font-mono text-xs tabular-nums text-muted px-1">
                    {c.size}
                  </td>
                  {c.retention.map((pct, o) => {
                    const cell = cohortCell(pct);
                    return (
                      <td key={o} className="p-0">
                        <div
                          className={`rounded-md py-1.5 text-[11px] font-semibold tabular-nums ${cell.cls}`}
                        >
                          {cell.text}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

// ── Adopción de features ─────────────────────────────────────────────────────
function FeatureSection({ features }: { features: FeatureAdoption[] }) {
  const max = Math.max(...features.map((f) => f.pct), 1);
  return (
    <section className="space-y-3">
      <SectionTitle hint="qué se usa y qué no">Adopción de features</SectionTitle>
      <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
        {features.map((f) => (
          <div key={f.key} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 truncate text-muted">{f.label}</span>
            <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${(f.pct / max) * 100}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono tabular-nums text-xs text-foreground">
              {f.users} · {f.pct}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Churn / dormancia ────────────────────────────────────────────────────────
function DormancySection({ d }: { d: Dormancy }) {
  const segs = [
    { label: "Activos (≤7d)", value: d.active7, cls: "bg-success", text: "text-success" },
    { label: "Dormidos 8-14d", value: d.dormant8_14, cls: "bg-warning", text: "text-warning" },
    { label: "Dormidos 15-30d", value: d.dormant15_30, cls: "bg-warning/60", text: "text-warning" },
    { label: "Perdidos +30d", value: d.dormant30plus, cls: "bg-danger", text: "text-danger" },
    { label: "Nunca activaron", value: d.neverActivated, cls: "bg-muted-2/40", text: "text-muted" },
  ];
  const total = d.total || 1;
  return (
    <section className="space-y-3">
      <SectionTitle hint="dónde está parada tu base ahora mismo">
        Dónde se va la gente
      </SectionTitle>
      <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
          {segs.map((s) =>
            s.value > 0 ? (
              <div
                key={s.label}
                className={s.cls}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={`${s.label}: ${s.value}`}
              />
            ) : null
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {segs.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${s.cls}`} />
              <span className="text-xs text-muted">{s.label}</span>
              <span className={`ml-auto font-mono text-xs font-bold tabular-nums ${s.text}`}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
        {d.neverActivated > 0 && (
          <p className="flex items-start gap-1.5 border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
            <Info size={12} className="mt-px shrink-0" />
            <span>
              <span className="text-foreground/80">{d.neverActivated} usuarios</span> se
              registraron y nunca cargaron nada: es la fuga más barata de tapar (mejorar
              onboarding / activación).
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

// ── Monetización ─────────────────────────────────────────────────────────────
function MonetizationSection({ m }: { m: Monetization }) {
  const tiles = [
    { label: "Premium activos", value: fmt(m.premiumActive), icon: Crown, accent: "text-primary" },
    { label: "Conversión", value: `${m.conversion}%`, icon: Users, accent: "text-foreground" },
    { label: "Vencen en 7d", value: fmt(m.expiring7d), icon: Repeat, accent: m.expiring7d > 0 ? "text-warning" : "text-muted" },
    { label: "Bajas de premium", value: fmt(m.churnedPremium), icon: TrendingDown, accent: m.churnedPremium > 0 ? "text-danger" : "text-muted" },
  ];
  return (
    <section className="space-y-3">
      <SectionTitle hint="estado actual · sin historial de pagos en la DB">
        Monetización
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-1.5 text-muted">
              <t.icon size={13} />
              <p className="text-[10px] uppercase tracking-widest">{t.label}</p>
            </div>
            <p className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${t.accent}`}>
              {t.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Caveats (honestidad de los datos) ────────────────────────────────────────
function Caveats() {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
        <Info size={12} /> Límites de estos datos
      </p>
      <ul className="space-y-1 text-[11px] leading-relaxed text-muted">
        <li>
          · Actividad = abrió el dashboard <span className="text-foreground/60">o</span> cargó
          un movimiento. Se <span className="text-foreground/70">subcuenta</span> a los usuarios
          que usan casi todo por WhatsApp (no abren la web).
        </li>
        <li>· Monetización: es el estado actual. No hay historial de pagos → sin MRR histórico.</li>
        <li>· Incluye cuentas de testers. La base es chica (beta): leer tendencias, no valores absolutos.</li>
      </ul>
    </div>
  );
}

export function CommandCenter({ m }: { m: BusinessMetrics }) {
  return (
    <div className="space-y-10">
      <HealthHero o={m.overview} mon={m.monetization} />
      <FunnelSection funnel={m.funnel} />
      <CohortSection data={m.cohorts} />
      <div className="grid gap-10 lg:grid-cols-2">
        <FeatureSection features={m.features} />
        <DormancySection d={m.dormancy} />
      </div>
      <MonetizationSection m={m.monetization} />
      <Caveats />
    </div>
  );
}
