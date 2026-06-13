"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

type MonthPoint = { label: string; income: number; expense: number; balance: number };

function kFormat(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p: any) => p.dataKey === "income")?.value ?? 0;
  const expense = payload.find((p: any) => p.dataKey === "expense")?.value ?? 0;
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground capitalize mb-1">{label}</p>
      <p className="font-mono text-success">+ {formatCurrency(income, "ARS")}</p>
      <p className="font-mono text-danger">− {formatCurrency(expense, "ARS")}</p>
    </div>
  );
}

export function IncomeExpenseChart({ data }: { data: MonthPoint[] }) {
  return (
    <div className="w-full h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={5} margin={{ top: 8, right: 4, left: -6, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--color-border)"
            strokeDasharray="3 3"
            opacity={0.5}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
            dy={4}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={46}
            tick={{ fill: "var(--color-muted)", fontSize: 10 }}
            tickFormatter={kFormat}
          />
          <Tooltip cursor={{ fill: "var(--color-surface-2)", opacity: 0.45 }} content={<BarTooltip />} />
          <Bar dataKey="income" fill="var(--color-success)" radius={[4, 4, 0, 0]} maxBarSize={20} animationDuration={650} />
          <Bar dataKey="expense" fill="var(--color-danger)" radius={[4, 4, 0, 0]} maxBarSize={20} animationDuration={650} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function NWTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground capitalize mb-1">{label}</p>
      <p className="font-mono text-primary">{formatCurrency(payload[0].value, "ARS")}</p>
    </div>
  );
}

export function NetWorthChart({ data }: { data: { label: string; patrimonio: number }[] }) {
  return (
    <div className="w-full h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -6, bottom: 0 }}>
          <defs>
            <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" opacity={0.5} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} dy={4} />
          <YAxis tickLine={false} axisLine={false} width={46} tick={{ fill: "var(--color-muted)", fontSize: 10 }} tickFormatter={kFormat} />
          <Tooltip content={<NWTooltip />} cursor={{ stroke: "var(--color-border)" }} />
          <Area
            type="monotone"
            dataKey="patrimonio"
            stroke="var(--color-primary)"
            strokeWidth={2.4}
            fill="url(#nw-fill)"
            dot={false}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceSparkline({ data }: { data: { label: string; balance: number }[] }) {
  const first = data[0]?.balance ?? 0;
  const last = data[data.length - 1]?.balance ?? 0;
  const positive = last >= first;
  const color = positive ? "var(--color-success)" : "var(--color-danger)";
  return (
    <div className="w-full h-14">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="balance"
            stroke={color}
            strokeWidth={2.2}
            fill="url(#spark-fill)"
            dot={false}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
