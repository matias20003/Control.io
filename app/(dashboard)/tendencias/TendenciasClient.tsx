"use client";

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import type { TrendsData } from "@/lib/db/trends";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props { trends: TrendsData }

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
    notation: "compact",
  }).format(n);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-xl p-3 text-sm shadow-xl">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value, "ARS")}
        </p>
      ))}
    </div>
  );
};

export function TendenciasClient({ trends }: Props) {
  const { months, categories, avgIncome, avgExpense, bestMonth, worstMonth } = trends;
  const hasData = months.some((m) => m.income > 0 || m.expense > 0);

  const currentMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];

  const incomeChange = prevMonth ? pctChange(currentMonth?.income ?? 0, prevMonth.income) : null;
  const expenseChange = prevMonth ? pctChange(currentMonth?.expense ?? 0, prevMonth.expense) : null;
  const balanceChange = prevMonth ? pctChange(currentMonth?.balance ?? 0, prevMonth.balance) : null;

  if (!hasData) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-4xl mb-3">📊</p>
        <h2 className="text-lg font-bold text-foreground mb-1">Sin datos todavía</h2>
        <p className="text-sm text-muted max-w-xs">
          Registrá movimientos durante algunos meses para ver tus tendencias.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tendencias</h1>
        <p className="text-sm text-muted mt-0.5">Últimos 6 meses de actividad financiera</p>
      </div>

      {/* ── KPIs vs mes anterior ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Ingresos", value: currentMonth?.income ?? 0, change: incomeChange, positive: true },
          { label: "Gastos", value: currentMonth?.expense ?? 0, change: expenseChange, positive: false },
          { label: "Balance", value: currentMonth?.balance ?? 0, change: balanceChange, positive: true },
        ].map((k) => {
          const up = (k.change ?? 0) > 0;
          const good = k.positive ? up : !up;
          const Icon = k.change === null ? Minus : up ? TrendingUp : TrendingDown;
          return (
            <Card key={k.label}>
              <CardContent className="p-3 md:p-4">
                <p className="text-[11px] text-muted font-medium mb-1">{k.label}</p>
                <p className={`text-base md:text-lg font-bold font-mono leading-tight ${k.value >= 0 ? "text-foreground" : "text-danger"}`}>
                  {fmt(k.value)}
                </p>
                {k.change !== null && (
                  <p className={`text-[11px] mt-1 flex items-center gap-0.5 ${good ? "text-success" : "text-danger"}`}>
                    <Icon size={11} />
                    {Math.abs(k.change)}% vs mes ant.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Bar chart: ingresos vs gastos ── */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-foreground mb-4">Ingresos vs Gastos</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={months} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--color-muted)", fontSize: 11 }} tickFormatter={fmt} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span style={{ color: "var(--color-muted)", fontSize: 12 }}>{v}</span>} />
              <Bar dataKey="income" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Line chart: balance mensual ── */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-foreground mb-4">Evolución del balance</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={months} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--color-muted)", fontSize: 11 }} tickFormatter={fmt} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="balance"
                name="Balance"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={{ fill: "var(--color-primary)", strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Savings rate ── */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-foreground mb-4">Tasa de ahorro mensual</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={months} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--color-muted)", fontSize: 11 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => [`${v}%`, "Ahorro"]} contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-foreground)" }} />
              <ReferenceLine y={20} stroke="#38bdf8" strokeDasharray="4 4" label={{ value: "meta 20%", fill: "var(--color-primary)", fontSize: 10, position: "right" }} />
              <Bar dataKey="savingsRate" name="Ahorro %" fill="var(--color-primary)" radius={[4, 4, 0, 0]}
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Top categorías ── */}
      {categories.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground mb-4">Top categorías de gasto</p>
            <div className="space-y-3">
              {categories.map((cat) => {
                const total = cat.months.reduce((s, x) => s + x, 0);
                const maxTotal = categories[0].months.reduce((s, x) => s + x, 0);
                const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground">{cat.icon} {cat.name}</span>
                      <span className="text-sm font-mono text-muted">{fmt(total)}</span>
                    </div>
                    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: cat.color ?? "#94a3b8" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Promedios ── */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted mb-1">Ingreso promedio mensual</p>
            <p className="text-lg font-bold font-mono text-success">{fmt(avgIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted mb-1">Gasto promedio mensual</p>
            <p className="text-lg font-bold font-mono text-danger">{fmt(avgExpense)}</p>
          </CardContent>
        </Card>
        {bestMonth && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted mb-1">Mejor mes 🏆</p>
              <p className="text-sm font-semibold text-foreground capitalize">{bestMonth.label}</p>
              <p className="text-base font-bold font-mono text-success">{fmt(bestMonth.balance)}</p>
            </CardContent>
          </Card>
        )}
        {worstMonth && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted mb-1">Mes más ajustado</p>
              <p className="text-sm font-semibold text-foreground capitalize">{worstMonth.label}</p>
              <p className={`text-base font-bold font-mono ${worstMonth.balance >= 0 ? "text-foreground" : "text-danger"}`}>{fmt(worstMonth.balance)}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
