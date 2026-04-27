"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface CategoryData {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  total: number;
}

interface Props {
  data: CategoryData[];
  totalExpense: number;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold text-foreground">
        {d.icon} {d.name}
      </p>
      <p className="font-mono text-foreground mt-0.5">
        {formatCurrency(d.total, "ARS")}
      </p>
      <p className="text-xs text-muted">{d.pct}% del total</p>
    </div>
  );
}

export function CategoryChart({ data, totalExpense }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    ...d,
    value: d.total,
    pct: totalExpense > 0 ? Math.round((d.total / totalExpense) * 100) : 0,
  }));

  const activeItem =
    activeIndex !== null ? chartData[activeIndex] : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">
              Gastos por categoría
            </p>
            <p className="text-2xl font-bold font-mono text-foreground mt-0.5">
              {formatCurrency(totalExpense, "ARS")}
            </p>
          </div>
          <span className="text-3xl opacity-80">
            {activeItem ? activeItem.icon : "📊"}
          </span>
        </div>

        {/* Chart + Legend */}
        <div className="flex flex-col md:flex-row">

          {/* Donut chart */}
          <div className="relative flex items-center justify-center py-6 md:w-56 md:flex-shrink-0">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  animationBegin={0}
                  animationDuration={600}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.categoryId}
                      fill={entry.color}
                      opacity={
                        activeIndex === null || activeIndex === index
                          ? 1
                          : 0.35
                      }
                      style={{ cursor: "pointer", outline: "none" }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{ zIndex: 50 }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                {activeItem ? (
                  <>
                    <p className="text-xs text-muted leading-tight">
                      {activeItem.icon}
                    </p>
                    <p className="text-sm font-bold font-mono text-foreground leading-tight">
                      {activeItem.pct}%
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted leading-tight">
                      {data.length} categ.
                    </p>
                    <p className="text-sm font-bold text-foreground leading-tight">
                      este mes
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Category rows */}
          <div className="flex-1 px-5 pb-5 md:pt-5 space-y-3 md:max-h-[240px] md:overflow-y-auto md:pr-4">
            {chartData.map((cat, index) => (
              <div
                key={cat.categoryId}
                className={`space-y-1.5 transition-opacity duration-150 ${
                  activeIndex !== null && activeIndex !== index
                    ? "opacity-40"
                    : "opacity-100"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {/* Row header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Color dot + icon */}
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm leading-none">{cat.icon}</span>
                    <span className="text-sm font-medium text-foreground truncate">
                      {cat.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted font-mono">
                      {cat.pct}%
                    </span>
                    <span className="text-sm font-bold font-mono text-foreground">
                      {formatCurrency(cat.total, "ARS")}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${cat.pct}%`,
                      backgroundColor: cat.color,
                      boxShadow: `0 0 6px ${cat.color}60`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer stats */}
        <div className="grid grid-cols-3 border-t border-border divide-x divide-border">
          <div className="px-4 py-3 text-center">
            <p className="text-xs text-muted">Categorías</p>
            <p className="text-lg font-bold text-foreground">{data.length}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-xs text-muted">Mayor gasto</p>
            <p className="text-sm font-bold text-foreground truncate">
              {chartData[0]?.icon} {chartData[0]?.name}
            </p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-xs text-muted">Promedio</p>
            <p className="text-sm font-bold font-mono text-foreground">
              {formatCurrency(
                data.length > 0 ? totalExpense / data.length : 0,
                "ARS"
              )}
            </p>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
