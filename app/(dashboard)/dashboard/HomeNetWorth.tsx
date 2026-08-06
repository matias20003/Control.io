"use client";

/**
 * El patrimonio en el Inicio, con la misma cuenta que hace Finanzas.
 *
 * Es un componente cliente por una sola razón: la conversión de monedas usa la
 * cotización del día y la que el usuario puede editar a mano, que vive en el
 * navegador. Calcularlo en el servidor daría un número distinto al de Finanzas
 * apenas alguien tocara el dólar — y de hecho daba otro antes de esto, porque
 * el Inicio sumaba únicamente la posición en pesos.
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { netWorthSeries, type CurrencyPosition } from "@/lib/net-worth";
import { useNetWorthRates } from "@/components/dashboard/useNetWorthRates";

export function HomeNetWorth({ positions, monthlyBalances, monthBalance }: {
  positions: CurrencyPosition[];
  monthlyBalances: { label: string; balance: number }[];
  monthBalance: number;
}) {
  const { totals, loading, hasForeign } = useNetWorthRates(positions);
  const series = netWorthSeries(monthlyBalances, totals.net);
  const delta = series.length > 1 ? series[series.length - 1].patrimonio - series[0].patrimonio : null;

  return (
    <>
      <div>
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {/* Mientras llega la cotización mostramos el total con lo que hay: un
              guion dejaría la pantalla en blanco medio segundo en cada carga. */}
          {formatCurrency(totals.net, "ARS")}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>Patrimonio neto</span>
          {delta !== null && (
            <span className={delta >= 0 ? "text-success" : "text-danger"}>
              {delta >= 0 ? "+" : "−"}{formatCurrency(Math.abs(delta), "ARS")} en {series.length} meses
            </span>
          )}
          {hasForeign && loading && <span className="opacity-60">actualizando cotización…</span>}
        </p>
      </div>

      {totals.missing > 0 && (
        <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-600">
          Falta la cotización de {totals.missing === 1 ? "una moneda" : `${totals.missing} monedas`}: ese saldo
          no está sumado. Cargala desde Finanzas.
        </p>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted">
        {monthBalance >= 0
          ? <><TrendingUp size={12} className="text-success" /> Este mes vas en positivo</>
          : <><TrendingDown size={12} className="text-danger" /> Este mes gastás más de lo que entra</>}
        <span className={`font-semibold tabular-nums ${monthBalance >= 0 ? "text-success" : "text-danger"}`}>
          {formatCurrency(monthBalance, "ARS")}
        </span>
      </p>

      <NetWorthArea points={series} />
    </>
  );
}

/**
 * La curva del patrimonio. Arranca en el mínimo de la serie y no en cero: si el
 * patrimonio se movió entre 300 y 320 mil, una escala desde cero dibuja una
 * línea recta y esconde justo lo que hay que ver.
 */
function NetWorthArea({ points }: { points: { label: string; patrimonio: number }[] }) {
  if (points.length < 2) return null;
  const width = 260;
  const height = 56;
  const values = points.map((point) => point.patrimonio);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const y = (value: number) => height - 4 - ((value - min) / span) * (height - 10);
  const x = (index: number) => (index / (points.length - 1)) * width;

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.patrimonio)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const rising = values[values.length - 1] >= values[0];

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Patrimonio mes a mes</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full" preserveAspectRatio="none" role="img"
        aria-label={`Evolución del patrimonio, hoy ${formatCurrency(values[values.length - 1], "ARS")}`}>
        <path d={area} className={rising ? "fill-primary/15" : "fill-danger/15"} />
        <path d={line} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          className={rising ? "stroke-primary" : "stroke-danger"} />
      </svg>
      <div className="flex justify-between text-[9px] uppercase text-muted">
        <span>{points[0].label.slice(0, 3)}</span>
        <span>{points[points.length - 1].label.slice(0, 3)}</span>
      </div>
    </div>
  );
}
