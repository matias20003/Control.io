"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Zap, Wallet, CreditCard, TrendingUp } from "lucide-react";
import { LogoIcon } from "@/components/layout/Logo";

/* ── Datos que van rotando cada 3.5 s ── */
const SNAPSHOTS = [
  {
    kpis: [
      { label: "Patrimonio", value: "$ 4.812.350", trend: "+12,4%", up: true },
      { label: "Mes",        value: "+$ 218.900",  trend: "+5,1%",  up: true },
      { label: "Ahorro",     value: "32,7%",       trend: "meta 30%", up: true },
    ],
    tendencia: "+$ 612.400",
    points: "0,40 20,32 40,36 60,28 80,30 100,22 120,24 140,18 160,20 180,12 200,14 220,8 240,10 260,4",
    rows: [
      { icon: "wallet", title: "Sueldo · Mayo",       sub: "Cuenta sueldo · Galicia", value: "+$ 1.420.000", positive: true  },
      { icon: "card",   title: "Visa · Cuota 3 de 6", sub: "Vence 14/05",             value: "-$ 86.500",    positive: false },
      { icon: "trend",  title: "USD · Plazo fijo",    sub: "Renta mensual",           value: "+US$ 142,80",  positive: true  },
    ],
  },
  {
    kpis: [
      { label: "Patrimonio", value: "$ 4.831.200", trend: "+12,9%", up: true },
      { label: "Mes",        value: "+$ 237.800",  trend: "+5,9%",  up: true },
      { label: "Ahorro",     value: "33,2%",       trend: "meta 30%", up: true },
    ],
    tendencia: "+$ 631.300",
    points: "0,38 20,30 40,32 60,24 80,26 100,18 120,20 140,13 160,15 180,8 200,10 220,4 240,6 260,2",
    rows: [
      { icon: "wallet", title: "Sueldo · Mayo",       sub: "Cuenta sueldo · Galicia", value: "+$ 1.420.000", positive: true  },
      { icon: "card",   title: "Visa · Cuota 3 de 6", sub: "Vence 14/05",             value: "-$ 86.500",    positive: false },
      { icon: "trend",  title: "CEDEAR · Apple",      sub: "Ganancia del mes",        value: "+$ 24.300",    positive: true  },
    ],
  },
  {
    kpis: [
      { label: "Patrimonio", value: "$ 4.797.500", trend: "+11,9%", up: true },
      { label: "Mes",        value: "+$ 198.200",  trend: "+4,4%",  up: true },
      { label: "Ahorro",     value: "31,5%",       trend: "meta 30%", up: true },
    ],
    tendencia: "+$ 598.100",
    points: "0,42 20,35 40,38 60,31 80,34 100,26 120,28 140,22 160,25 180,16 200,18 220,12 240,14 260,8",
    rows: [
      { icon: "wallet", title: "Sueldo · Mayo",       sub: "Cuenta sueldo · Galicia", value: "+$ 1.420.000", positive: true  },
      { icon: "card",   title: "Amex · Cuota 1 de 3", sub: "Vence 20/05",             value: "-$ 42.000",    positive: false },
      { icon: "trend",  title: "USD · Plazo fijo",    sub: "Renta mensual",           value: "+US$ 142,80",  positive: true  },
    ],
  },
];

export function DashboardMockAnimated() {
  const [idx, setIdx]       = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((p) => (p + 1) % SNAPSHOTS.length);
        setVisible(true);
      }, 280);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  const snap = SNAPSHOTS[idx];

  return (
    <div className="relative">
      {/* Glow ambiental */}
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/30 via-secondary/20 to-transparent blur-2xl" />

      {/* Tarjeta */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface/80 p-5 shadow-2xl shadow-primary/10 backdrop-blur">

        {/* Barra de título */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted">
            <LogoIcon size={14} />
            control.io / dashboard
          </div>
        </div>

        {/* Contenido animado */}
        <div
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(5px)",
            transition: "opacity 0.28s ease, transform 0.28s ease",
          }}
        >
          {/* KPIs */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {snap.kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-border/60 bg-background/60 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted">{kpi.label}</div>
                <div className="mt-1 font-mono text-sm font-semibold text-foreground sm:text-base">{kpi.value}</div>
                <div className={`mt-1 text-[10px] ${kpi.up ? "text-success" : "text-danger"}`}>{kpi.trend}</div>
              </div>
            ))}
          </div>

          {/* Gráfico */}
          <div className="mt-5 rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-muted">Tendencia · 90 días</span>
              <span className="font-mono text-primary">{snap.tendencia}</span>
            </div>
            <AnimatedSparkline key={`spark-${idx}`} points={snap.points} />
          </div>

          {/* Lista de movimientos */}
          <div className="mt-4 space-y-2">
            {snap.rows.map((row, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface">
                    {row.icon === "wallet" && <Wallet    className="h-4 w-4 text-primary" />}
                    {row.icon === "card"   && <CreditCard className="h-4 w-4 text-warning" />}
                    {row.icon === "trend"  && <TrendingUp className="h-4 w-4 text-success" />}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground">{row.title}</div>
                    <div className="text-[10px] text-muted">{row.sub}</div>
                  </div>
                </div>
                <div className={`font-mono text-xs ${row.positive ? "text-success" : "text-danger"}`}>
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pills flotantes */}
      <div className="absolute -bottom-4 left-6 hidden items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur sm:flex">
        <ShieldCheck className="h-4 w-4 text-success" />
        <span className="text-muted">Cifrado AES-256</span>
      </div>
      <div className="absolute -top-3 right-6 hidden items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur sm:flex">
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-muted">Tiempo real</span>
      </div>
    </div>
  );
}

/* ── Sparkline con animación de dibujo ── */
function AnimatedSparkline({ points }: { points: string }) {
  return (
    <svg viewBox="0 0 260 50" className="h-14 w-full">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Área rellena */}
      <polyline
        points={`0,50 ${points} 260,50`}
        fill="url(#spark-fill)"
        stroke="none"
        className="sparkline-fill"
      />
      {/* Línea animada */}
      <polyline
        points={points}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sparkline-line"
      />
    </svg>
  );
}
