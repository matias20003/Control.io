"use client";

import { useState, useEffect, useRef } from "react";
import { ShieldCheck, Zap, Wallet, CreditCard, TrendingUp } from "lucide-react";
import { LogoIcon } from "@/components/layout/Logo";

/* ── Helpers ── */
function fmtARS(n: number) {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}
function fmtPct(n: number) {
  return n.toFixed(1).replace(".", ",") + "%";
}

/* ── Sparkline continua ── */
const N_POINTS = 14;
const W = 260;
const H = 50;

function generatePoints(prev: number[]): number[] {
  const last = prev[prev.length - 1];
  const next = Math.max(4, Math.min(46, last + (Math.random() - 0.38) * 7));
  return [...prev.slice(1), next];
}

function initPoints(): number[] {
  const pts: number[] = [30];
  for (let i = 1; i < N_POINTS; i++) {
    pts.push(Math.max(4, Math.min(46, pts[i - 1] + (Math.random() - 0.38) * 7)));
  }
  return pts;
}

function toSvgPoints(ys: number[]) {
  return ys.map((y, i) => `${(i / (N_POINTS - 1)) * W},${y}`).join(" ");
}

/* ── Filas de movimientos (rotan cada 5 s) ── */
const ROW_SETS = [
  [
    { icon: "wallet", title: "Sueldo · Mayo",       sub: "Cta. sueldo · Galicia", value: "+$ 1.420.000", positive: true  },
    { icon: "card",   title: "Visa · Cuota 3 de 6", sub: "Vence 14/05",           value: "-$ 86.500",    positive: false },
    { icon: "trend",  title: "USD · Plazo fijo",    sub: "Renta mensual",         value: "+US$ 142,80",  positive: true  },
  ],
  [
    { icon: "wallet", title: "Honorarios · Mayo",   sub: "Cuenta corriente",      value: "+$ 980.000",   positive: true  },
    { icon: "card",   title: "Amex · Cuota 1 de 3", sub: "Vence 20/05",           value: "-$ 42.000",    positive: false },
    { icon: "trend",  title: "CEDEAR · Apple",      sub: "Ganancia del mes",      value: "+$ 24.300",    positive: true  },
  ],
  [
    { icon: "wallet", title: "Alquiler cobrado",    sub: "Prop. Palermo",          value: "+$ 620.000",   positive: true  },
    { icon: "card",   title: "Expensas · Mayo",     sub: "Vence 10/05",            value: "-$ 58.200",    positive: false },
    { icon: "trend",  title: "Bono USD",            sub: "Renta trimestral",       value: "+US$ 88,00",   positive: true  },
  ],
];

export function DashboardMockAnimated() {
  /* Valores base */
  const patrimonioRef = useRef(4_812_350);
  const mesRef        = useRef(218_900);
  const ahorroRef     = useRef(32.7);
  const tendenciaRef  = useRef(612_400);

  const [patrimonio, setPatrimonio] = useState(patrimonioRef.current);
  const [mes,        setMes]        = useState(mesRef.current);
  const [ahorro,     setAhorro]     = useState(ahorroRef.current);
  const [tendencia,  setTendencia]  = useState(tendenciaRef.current);

  /* Sparkline */
  const [ys,     setYs]     = useState<number[]>(initPoints);
  const [rowIdx, setRowIdx] = useState(0);

  /* Tick de números — cada 120 ms */
  useEffect(() => {
    const id = setInterval(() => {
      patrimonioRef.current += (Math.random() - 0.35) * 800;
      mesRef.current        += (Math.random() - 0.35) * 300;
      ahorroRef.current      = Math.max(18, Math.min(55, ahorroRef.current + (Math.random() - 0.35) * 0.08));
      tendenciaRef.current  += (Math.random() - 0.35) * 500;

      setPatrimonio(patrimonioRef.current);
      setMes(mesRef.current);
      setAhorro(ahorroRef.current);
      setTendencia(tendenciaRef.current);
    }, 120);
    return () => clearInterval(id);
  }, []);

  /* Nuevo punto en el gráfico — cada 600 ms */
  useEffect(() => {
    const id = setInterval(() => {
      setYs((prev) => generatePoints(prev));
    }, 600);
    return () => clearInterval(id);
  }, []);

  /* Rotar filas — cada 5 s */
  useEffect(() => {
    const id = setInterval(() => {
      setRowIdx((p) => (p + 1) % ROW_SETS.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const rows    = ROW_SETS[rowIdx];
  const svgPts  = toSvgPoints(ys);
  const mesPos  = mes >= 0;
  const tenPos  = tendencia >= 0;

  return (
    <div className="relative">
      {/* Glow */}
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

        {/* KPIs — números vivos */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <KpiTile label="Patrimonio" value={fmtARS(patrimonio)} trend="+12,4%" up />
          <KpiTile
            label="Mes"
            value={(mesPos ? "+" : "") + fmtARS(mes)}
            trend={(mesPos ? "+" : "") + fmtPct(mes / 14_200)}
            up={mesPos}
          />
          <KpiTile label="Ahorro" value={fmtPct(ahorro)} trend="meta 30%" up={ahorro >= 30} />
        </div>

        {/* Gráfico continuo */}
        <div className="mt-5 rounded-xl border border-border/60 bg-background/60 p-4">
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="text-muted">Tendencia · 90 días</span>
            <span className={`font-mono ${tenPos ? "text-primary" : "text-danger"}`}>
              {tenPos ? "+" : ""}{fmtARS(tendencia)}
            </span>
          </div>
          <LiveSparkline ys={ys} svgPts={svgPts} />
        </div>

        {/* Filas de movimientos */}
        <div className="mt-4 space-y-2">
          {rows.map((row, i) => (
            <div
              key={`${rowIdx}-${i}`}
              className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface">
                  {row.icon === "wallet" && <Wallet     className="h-4 w-4 text-primary" />}
                  {row.icon === "card"   && <CreditCard  className="h-4 w-4 text-warning" />}
                  {row.icon === "trend"  && <TrendingUp  className="h-4 w-4 text-success" />}
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

      {/* Pills */}
      <div className="absolute -bottom-4 left-6 hidden items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur sm:flex">
        <ShieldCheck className="h-4 w-4 text-success" />
        <span className="text-muted">Cifrado AES-256</span>
      </div>
      <div className="absolute -top-3 right-6 hidden items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur sm:flex">
        <Zap className="h-4 w-4 text-primary animate-pulse" />
        <span className="text-muted">En vivo</span>
      </div>
    </div>
  );
}

/* ── KPI tile ── */
function KpiTile({ label, value, trend, up }: { label: string; value: string; trend: string; up?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums sm:text-base">{value}</div>
      <div className={`mt-1 text-[10px] ${up ? "text-success" : "text-danger"}`}>{trend}</div>
    </div>
  );
}

/* ── Sparkline viva ── */
function LiveSparkline({ ys, svgPts }: { ys: number[]; svgPts: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" style={{ transition: "all 0.5s ease" }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0"   />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${H} ${svgPts} ${W},${H}`}
        fill="url(#spark-fill)"
        stroke="none"
        style={{ transition: "points 0.55s ease" }}
      />
      <polyline
        points={svgPts}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "points 0.55s ease" }}
      />
      {/* Punto activo al final */}
      <circle
        cx={W}
        cy={ys[ys.length - 1]}
        r="3"
        fill="#38bdf8"
        className="sparkline-dot"
      />
    </svg>
  );
}
