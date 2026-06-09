"use client";

import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { CountUp } from "@/components/landing/fx";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Barras ingresos vs gastos (crecen al entrar en viewport) ── */
const MONTHS = [
  { l: "Ene", i: 210, e: 150 },
  { l: "Feb", i: 240, e: 160 },
  { l: "Mar", i: 230, e: 175 },
  { l: "Abr", i: 260, e: 168 },
  { l: "May", i: 250, e: 172 },
  { l: "Jun", i: 400, e: 88 },
];
const MAXV = Math.max(...MONTHS.flatMap((m) => [m.i, m.e]));
const BARH = 170;

function AnimatedBars() {
  return (
    <div className="flex h-[200px] items-end gap-3 px-1">
      {MONTHS.map((m, idx) => (
        <div key={m.l} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-[170px] w-full items-end justify-center gap-1">
            <motion.div
              className="w-2.5 rounded-t-md bg-success md:w-3"
              initial={{ height: 0 }}
              whileInView={{ height: (m.i / MAXV) * BARH }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.9, delay: 0.05 * idx, ease: EASE }}
            />
            <motion.div
              className="w-2.5 rounded-t-md bg-danger md:w-3"
              initial={{ height: 0 }}
              whileInView={{ height: (m.e / MAXV) * BARH }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.9, delay: 0.05 * idx + 0.08, ease: EASE }}
            />
          </div>
          <span className="text-[10px] text-muted">{m.l}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Donut por categoría (cada segmento se "dibuja") ── */
const CATS = [
  { label: "Comida", pct: 32, color: "#22c55e" },
  { label: "Casa", pct: 25, color: "#3b82f6" },
  { label: "Transporte", pct: 17, color: "#f59e0b" },
  { label: "Ocio", pct: 11, color: "#a855f7" },
  { label: "Salud", pct: 7, color: "#ef4444" },
  { label: "Otros", pct: 8, color: "#64748b" },
];

function AnimatedDonut() {
  const size = 184;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  let acc = 0;

  return (
    <div className="relative grid place-items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          {CATS.map((s, i) => {
            const frac = s.pct / 100;
            const start = acc;
            acc += frac;
            return (
              <motion.circle
                key={s.label}
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeLinecap="butt"
                transform={`rotate(${start * 360} ${cx} ${cx})`}
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: frac }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.9, delay: 0.25 + i * 0.12, ease: EASE }}
              />
            );
          })}
        </g>
      </svg>
      <div className="absolute text-center">
        <p className="font-mono text-lg font-bold text-foreground">
          <CountUp value={88390} prefix="$" />
        </p>
        <p className="text-[11px] text-muted">gastos del mes</p>
      </div>
    </div>
  );
}

/* ── Línea de balance que se traza ── */
function DrawLine() {
  // Path normalizado a 0..100 x, 0..40 y (invertido)
  const pts = [38, 34, 36, 30, 26, 22, 18, 20, 14, 10, 8];
  const w = 320;
  const h = 56;
  const step = w / (pts.length - 1);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${((p / 40) * h).toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id="ld-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--color-primary)" />
        </linearGradient>
      </defs>
      <motion.path
        d={d}
        fill="none"
        stroke="url(#ld-line)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 1.4, ease: EASE }}
      />
    </svg>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  prefix = "",
  suffix = "",
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{label}</p>
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 font-mono text-xl font-bold text-foreground">
        <CountUp value={value} prefix={prefix} suffix={suffix} />
      </p>
    </div>
  );
}

export function LiveDashboard() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs uppercase tracking-widest text-muted backdrop-blur">
          Tu plata, viva
        </span>
        <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          Tu mes entero, <span className="text-primary">de un vistazo.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          Números que se entienden solos y gráficos que te muestran a dónde se va cada peso. Esto es un ejemplo — así se ve tu dashboard.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {/* KPIs + barras */}
        <div className="lg:col-span-2 rounded-3xl border border-border bg-surface/40 p-5 backdrop-blur sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={TrendingUp} label="Ingresos" value={400000} prefix="$" accent="bg-success/15 text-success" />
            <Kpi icon={TrendingDown} label="Gastos" value={88390} prefix="$" accent="bg-danger/15 text-danger" />
            <Kpi icon={Wallet} label="Balance" value={311610} prefix="$" accent="bg-primary/15 text-primary" />
            <Kpi icon={PiggyBank} label="Ahorro" value={24} suffix="%" accent="bg-emerald-500/15 text-emerald-400" />
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-background/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Ingresos vs gastos</p>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" /> Ingresos</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-danger" /> Gastos</span>
              </div>
            </div>
            <AnimatedBars />
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Evolución del balance</p>
            <DrawLine />
          </div>
        </div>

        {/* Donut */}
        <div className="rounded-3xl border border-border bg-surface/40 p-5 backdrop-blur sm:p-6">
          <p className="text-sm font-semibold text-foreground">Gastos por categoría</p>
          <div className="mt-4">
            <AnimatedDonut />
          </div>
          <div className="mt-5 space-y-2.5">
            {CATS.map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-xs text-foreground">{c.label}</span>
                <span className="ml-auto text-xs font-mono text-muted">{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
