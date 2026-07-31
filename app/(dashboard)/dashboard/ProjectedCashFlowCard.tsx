"use client";

import Link from "next/link";
import { ArrowUp, CalendarDays, ChevronRight } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AgendaEvent } from "@/lib/db/agenda";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type ProjectionPoint = {
  date: string;
  label: string;
  balance: number;
  delta: number;
};

function dateKey(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

function buildProjection(startingBalance: number, events: AgendaEvent[]): ProjectionPoint[] {
  const changes = new Map<string, number>();
  for (const event of events) {
    const key = dateKey(event.date);
    const signed = event.cashFlow === "income" ? event.amount : -event.amount;
    changes.set(key, (changes.get(key) ?? 0) + signed);
  }

  const formatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" });
  const points: ProjectionPoint[] = [];
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  let balance = startingBalance;

  for (let day = 0; day <= 30; day++) {
    const date = new Date(start);
    date.setDate(start.getDate() + day);
    const key = dateKey(date);
    const delta = changes.get(key) ?? 0;
    balance += delta;
    points.push({
      date: key,
      label: formatter.format(date).replace(".", ""),
      balance,
      delta,
    });
  }
  return points;
}

function ProjectionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ProjectionPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold capitalize text-foreground">{point.label}</p>
      <p className="mt-1 font-mono text-primary">{formatCurrency(point.balance, "ARS")}</p>
      {point.delta !== 0 && (
        <p className={point.delta > 0 ? "font-mono text-success" : "font-mono text-danger"}>
          {point.delta > 0 ? "+" : "−"} {formatCurrency(Math.abs(point.delta), "ARS")}
        </p>
      )}
    </div>
  );
}

function EventDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: ProjectionPoint }) {
  if (cx == null || cy == null || !payload?.delta) return <g />;
  const positive = payload.delta > 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill={positive ? "var(--color-success)" : "var(--color-danger)"} />
      <path
        d={positive ? `M ${cx - 3} ${cy + 1} L ${cx} ${cy - 2} L ${cx + 3} ${cy + 1}` : `M ${cx - 3} ${cy - 1} L ${cx} ${cy + 2} L ${cx + 3} ${cy - 1}`}
        fill="none"
        stroke="var(--color-surface)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </g>
  );
}

export function ProjectedCashFlowCard({
  startingBalance,
  events,
}: {
  startingBalance: number;
  events: AgendaEvent[];
}) {
  const arsEvents = events
    .filter((event) => event.currency === "ARS")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const income = arsEvents
    .filter((event) => event.cashFlow === "income")
    .reduce((sum, event) => sum + event.amount, 0);
  const expense = arsEvents
    .filter((event) => event.cashFlow === "expense")
    .reduce((sum, event) => sum + event.amount, 0);
  const projectedBalance = startingBalance + income - expense;
  const points = buildProjection(startingBalance, arsEvents);
  const minimumBalance = Math.min(...points.map((point) => point.balance));
  const balanced = minimumBalance >= 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Flujo proyectado · 30 días
            </p>
            <p className="mt-2 text-xs text-muted">Saldo proyectado</p>
            <p className="font-mono text-2xl font-bold text-foreground">
              {formatCurrency(projectedBalance, "ARS")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <Link href="/agenda" className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
              Ver agenda <ChevronRight size={12} />
            </Link>
            <span className={balanced ? "rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success" : "rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger"}>
              {balanced ? "En equilibrio" : "Riesgo de faltante"}
            </span>
          </div>
        </div>

        <div className="h-[145px] w-full px-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" opacity={0.55} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={5}
                tick={{ fill: "var(--color-muted)", fontSize: 10 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fill: "var(--color-muted)", fontSize: 10 }}
                tickFormatter={shortAmount}
              />
              <Tooltip content={<ProjectionTooltip />} cursor={{ stroke: "var(--color-border)" }} />
              <Line
                type="stepAfter"
                dataKey="balance"
                stroke="var(--color-primary)"
                strokeWidth={2.3}
                dot={<EventDot />}
                activeDot={{ r: 4, fill: "var(--color-primary)", stroke: "var(--color-surface)", strokeWidth: 2 }}
                animationDuration={650}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="px-5 pb-3 text-[10px] text-muted">
          Basado en movimientos programados en ARS.
        </p>

        <div className="grid grid-cols-2 divide-x divide-border border-y border-border">
          <div className="px-4 py-2.5 text-center">
            <p className="text-xs text-muted">Ingresos previstos</p>
            <p className="font-mono text-base font-bold text-success">+ {formatCurrency(income, "ARS")}</p>
          </div>
          <div className="px-4 py-2.5 text-center">
            <p className="text-xs text-muted">Pagos previstos</p>
            <p className="font-mono text-base font-bold text-danger">− {formatCurrency(expense, "ARS")}</p>
          </div>
        </div>

        {arsEvents.length > 0 ? (
          <div className="divide-y divide-border">
            {arsEvents.slice(0, 3).map((event) => {
              const positive = event.cashFlow === "income";
              return (
                <Link key={event.id} href="/agenda" className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2">
                  <span className={positive ? "text-success" : "text-muted"}>
                    {positive ? <ArrowUp size={15} /> : <CalendarDays size={15} />}
                  </span>
                  <span className="w-12 shrink-0 text-xs capitalize text-muted">{event.dateLabel}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{event.title}</span>
                  <span className={positive ? "shrink-0 font-mono text-sm font-bold text-success" : "shrink-0 font-mono text-sm font-bold text-danger"}>
                    {positive ? "+" : "−"} {formatCurrency(event.amount, "ARS")}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[116px] flex-col items-center justify-center px-5 text-center">
            <CalendarDays size={20} className="text-muted" />
            <p className="mt-2 text-sm font-medium text-foreground">Sin movimientos programados</p>
            <Link href="/recurrentes" className="mt-1 text-xs text-primary hover:underline">
              Agregar ingresos o pagos recurrentes
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
