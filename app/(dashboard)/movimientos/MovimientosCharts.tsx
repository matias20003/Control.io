"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

type Pt = { day: string; income: number; expense: number; net: number };

function kFmt(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

function FlowTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = (k: string) => payload.find((x: any) => x.dataKey === k)?.value ?? 0;
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">Día {label}</p>
      <p className="font-mono text-success">+ {formatCurrency(p("income"), "ARS")}</p>
      <p className="font-mono text-danger">− {formatCurrency(p("expense"), "ARS")}</p>
      <p className="font-mono text-primary">Neto {formatCurrency(p("net"), "ARS")}</p>
    </div>
  );
}

/** Heatmap calendario: intensidad de actividad por día (verde neto +, rojo neto −). */
export function ActivityHeatmap({ data, month, year }: { data: Pt[]; month: number; year: number }) {
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Lunes = 0
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.net)));
  const labels = ["L", "M", "M", "J", "V", "S", "D"];

  const cells: (Pt | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (const d of data) cells.push(d);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {labels.map((l, i) => (
          <div key={i} className="text-[10px] text-muted text-center">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          const has = c.income > 0 || c.expense > 0;
          const intensity = has ? Math.min(1, Math.abs(c.net) / maxAbs) * 0.8 + 0.2 : 1;
          const bg = !has
            ? "var(--color-surface-2)"
            : c.net >= 0
            ? "var(--color-success)"
            : "var(--color-danger)";
          return (
            <div
              key={i}
              title={has ? `Día ${c.day}: +${formatCurrency(c.income, "ARS")} / −${formatCurrency(c.expense, "ARS")}` : `Día ${c.day}: sin actividad`}
              className="aspect-square rounded-md"
              style={{ backgroundColor: bg, opacity: intensity }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function DailyFlowChart({ data }: { data: Pt[] }) {
  return (
    <div className="w-full h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 6, left: -6, bottom: 0 }}>
          <defs>
            <linearGradient id="flow-inc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="flow-exp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-danger)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-danger)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" opacity={0.5} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted)", fontSize: 10 }} interval={4} dy={4} />
          <YAxis tickLine={false} axisLine={false} width={46} tick={{ fill: "var(--color-muted)", fontSize: 10 }} tickFormatter={kFmt} />
          <Tooltip content={<FlowTip />} />
          <Area type="monotone" dataKey="income" stroke="var(--color-success)" strokeWidth={1.5} fill="url(#flow-inc)" dot={false} animationDuration={600} />
          <Area type="monotone" dataKey="expense" stroke="var(--color-danger)" strokeWidth={1.5} fill="url(#flow-exp)" dot={false} animationDuration={600} />
          <Line type="monotone" dataKey="net" stroke="var(--color-primary)" strokeWidth={2} dot={false} animationDuration={700} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
