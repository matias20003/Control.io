"use client";

import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import type { ReporteSemanal } from "@/lib/db/reporte-semanal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Minus,
  ArrowDownLeft, ArrowUpRight, Flame,
} from "lucide-react";

interface Props {
  reporte: ReporteSemanal;
  currentOffset: number;
}

function fmt(n: number) {
  const s = new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
    notation: "compact",
  }).format(n);
  // Normalize compact suffix case — Node.js and browser ICU differ (k vs K, m vs M)
  return s.replace(/\b([kmbt])\b/gi, (c) => c.toUpperCase());
}

function ChangeTag({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value > 0;
  const Icon = value === 0 ? Minus : up ? TrendingUp : TrendingDown;
  const color = up ? "text-danger bg-danger/10" : "text-success bg-success/10";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${color}`}>
      <Icon size={9} />
      {Math.abs(value)}%
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-xl p-3 text-xs shadow-xl">
      <p className="font-semibold text-foreground mb-1 capitalize">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value, "ARS")}
        </p>
      ))}
    </div>
  );
};

export function ReporteClient({ reporte: r, currentOffset }: Props) {
  const router = useRouter();

  const goTo = (offset: number) => {
    router.push(offset === 0 ? "/reporte" : `/reporte?semana=${offset}`);
  };

  const hasData = r.income > 0 || r.expense > 0;

  const weekRange = `${new Date(r.weekStart).toLocaleDateString("es-AR", { day: "numeric", month: "short" })} – ${new Date(r.weekEnd).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">

      {/* ── Header + nav ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => goTo(currentOffset + 1)}
          className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-lg font-bold text-foreground">{r.weekLabel}</h1>
          <p className="text-xs text-muted capitalize">{weekRange}</p>
        </div>
        <button
          onClick={() => goTo(currentOffset - 1)}
          disabled={currentOffset === 0}
          className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-colors disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <p className="text-4xl mb-3">🗓️</p>
          <p className="text-base font-semibold text-foreground">Sin movimientos esta semana</p>
          <p className="text-sm text-muted mt-1">No se registraron ingresos ni gastos.</p>
        </div>
      ) : (
        <>
          {/* ── Métricas principales ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Ingresos", value: r.income, color: "text-success", change: r.incomeChange, positiveGood: true },
              { label: "Gastos",   value: r.expense, color: "text-danger",  change: r.expenseChange, positiveGood: false },
              { label: "Balance",  value: r.balance, color: r.balance >= 0 ? "text-success" : "text-danger", change: null, positiveGood: true },
            ].map((m) => (
              <Card key={m.label}>
                <CardContent className="p-3 text-center">
                  <p className="text-[11px] text-muted mb-1">{m.label}</p>
                  <p className={`text-base font-bold font-mono leading-tight ${m.color}`}>
                    {fmt(m.value)}
                  </p>
                  {m.change !== null && (
                    <div className="mt-1 flex justify-center">
                      <ChangeTag value={m.change} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Stats secundarias ── */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-surface rounded-xl border border-border p-3">
              <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Movimientos</p>
              <p className="text-xl font-bold text-foreground">{r.txCount}</p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-3">
              <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Gasto/día</p>
              <p className="text-base font-bold font-mono text-foreground">{fmt(r.avgDailyExpense)}</p>
            </div>
            <div className={`rounded-xl border p-3 ${r.savingsRate >= 20 ? "bg-success/10 border-success/20" : r.savingsRate < 0 ? "bg-danger/10 border-danger/20" : "bg-surface border-border"}`}>
              <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Ahorro</p>
              <p className={`text-xl font-bold ${r.savingsRate >= 20 ? "text-success" : r.savingsRate < 0 ? "text-danger" : "text-foreground"}`}>
                {r.savingsRate}%
              </p>
            </div>
          </div>

          {/* ── Gráfico por día ── */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground mb-4">Gastos por día</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={r.byDay} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                    tickFormatter={fmt}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="expense" name="Gastos" radius={[6, 6, 0, 0]}>
                    {r.byDay.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.expense > r.avgDailyExpense * 1.5 ? "#ef4444" : "#38bdf8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Por categoría ── */}
          {r.byCategory.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-foreground mb-4">Por categoría</p>
                <div className="space-y-3">
                  {r.byCategory.map((c) => (
                    <div key={c.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{c.icon}</span>
                          <span className="text-sm text-foreground">{c.name}</span>
                          <span className="text-[10px] text-muted">{c.count} mov.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted">{c.percentage}%</span>
                          <span className="text-sm font-bold font-mono text-danger">{fmt(c.total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${c.percentage}%`, backgroundColor: c.color ?? "#94a3b8" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Mayor gasto ── */}
          {r.biggestExpense && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-center gap-3">
              <Flame size={20} className="text-danger shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted mb-0.5">Mayor gasto de la semana</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {r.biggestExpense.description ?? "Sin descripción"}
                </p>
                <p className="text-xs text-muted">
                  {formatDate(r.biggestExpense.date)}
                  {r.biggestExpense.categoryName && ` · ${r.biggestExpense.categoryIcon} ${r.biggestExpense.categoryName}`}
                </p>
              </div>
              <p className="text-base font-bold font-mono text-danger shrink-0">
                {formatCurrency(r.biggestExpense.amount, r.biggestExpense.currency)}
              </p>
            </div>
          )}

          {/* ── Lista de transacciones ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">
              Todos los movimientos ({r.transactions.length})
            </p>
            {r.transactions.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">Sin movimientos</p>
            ) : (
              r.transactions.map((tx) => {
                const isIncome = tx.type === "INCOME";
                const Icon = isIncome ? ArrowDownLeft : ArrowUpRight;
                return (
                  <Card key={tx.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isIncome ? "bg-success/10" : "bg-danger/10"}`}>
                        {tx.categoryIcon
                          ? <span className="text-sm">{tx.categoryIcon}</span>
                          : <Icon size={14} className={isIncome ? "text-success" : "text-danger"} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {tx.description ?? "Sin descripción"}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(tx.date)}
                          {tx.categoryName && ` · ${tx.categoryName}`}
                          {tx.accountName && ` · ${tx.accountName}`}
                        </p>
                      </div>
                      <p className={`text-sm font-bold font-mono shrink-0 ${isIncome ? "text-success" : "text-danger"}`}>
                        {isIncome ? "+" : "-"}{formatCurrency(tx.amount, tx.currency)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
