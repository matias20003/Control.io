"use client";

/**
 * Patrimonio neto multi-moneda.
 *
 * El servidor manda la posición neta de cada moneda sin convertir; acá la
 * pasamos toda a pesos con la cotización del día de DolarAPI (el mismo endpoint
 * que usan las transferencias). La cotización se puede editar a mano: el valor
 * propio queda en localStorage y pisa al de la API hasta que se resetea.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, Pencil, RefreshCw, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useLocalValue } from "@/lib/client-store";
import { NetWorthChart } from "./DashboardCharts";

const OVERRIDES_KEY = "controlio:nw-rates";

export type CurrencyPosition = {
  currency: string;
  assets: number;
  liabilities: number;
  net: number;
};

type Rate = {
  currency: string;
  name: string;
  buy: number;
  sell: number;
  updatedAt: string;
  source: string;
};

type Props = {
  positions: CurrencyPosition[];
  monthlyBalances: { label: string; balance: number }[];
};

/** Cotización efectiva de una moneda y de dónde salió. */
type Resolved = {
  position: CurrencyPosition;
  rate: number | null;
  manual: boolean;
  reference: Rate | null;
};

function parseRate(value: string): number | null {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function NetWorthCard({ positions, monthlyBalances }: Props) {
  const foreign = useMemo(
    () => positions.filter((p) => p.currency !== "ARS").map((p) => p.currency),
    [positions],
  );
  // La lista de monedas cambia poco; la serializamos para usarla como dependencia
  // estable del efecto que trae las cotizaciones.
  const foreignKey = foreign.join(",");

  // Guardamos junto a las cotizaciones la clave del pedido que las trajo. Así
  // "cargando" se deriva (clave pedida ≠ clave cargada) en vez de ser otro
  // estado que haya que sincronizar a mano desde el efecto.
  const [loaded, setLoaded] = useState<{ key: string; rates: Record<string, Rate> } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const [overridesRaw, setOverridesRaw] = useLocalValue(OVERRIDES_KEY);
  const overrides = useMemo<Record<string, number>>(() => {
    if (!overridesRaw) return {};
    try {
      const parsed = JSON.parse(overridesRaw) as Record<string, unknown>;
      const clean: Record<string, number> = {};
      for (const [currency, value] of Object.entries(parsed)) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) clean[currency] = n;
      }
      return clean;
    } catch {
      return {};
    }
  }, [overridesRaw]);

  const setOverride = useCallback(
    (currency: string, value: number | null) => {
      const next = { ...overrides };
      if (value === null) delete next[currency];
      else next[currency] = value;
      setOverridesRaw(Object.keys(next).length ? JSON.stringify(next) : null);
    },
    [overrides, setOverridesRaw],
  );

  const fetchKey = `${foreignKey}|${refreshKey}`;
  // Mientras se refresca seguimos mostrando las cotizaciones anteriores.
  const rates = useMemo(() => loaded?.rates ?? {}, [loaded]);
  const loading = foreign.length > 0 && loaded?.key !== fetchKey;

  useEffect(() => {
    const currencies = foreignKey ? foreignKey.split(",") : [];
    if (currencies.length === 0) return;
    const controller = new AbortController();
    Promise.all(
      currencies.map(async (currency) => {
        try {
          const response = await fetch(
            `/api/cotizaciones/referencia?currency=${encodeURIComponent(currency)}`,
            { signal: controller.signal, cache: "no-store" },
          );
          const payload = await response.json();
          return payload.ok ? (payload.data as Rate) : null;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const next: Record<string, Rate> = {};
      for (const rate of results) if (rate) next[rate.currency] = rate;
      setLoaded({ key: `${foreignKey}|${refreshKey}`, rates: next });
    });
    return () => controller.abort();
  }, [foreignKey, refreshKey]);

  const resolved = useMemo<Resolved[]>(
    () =>
      positions.map((position) => {
        if (position.currency === "ARS") {
          return { position, rate: 1, manual: false, reference: null };
        }
        const reference = rates[position.currency] ?? null;
        const override = overrides[position.currency];
        // Por defecto valuamos a la compra: es lo que recibirías si vendieras
        // hoy la tenencia. La cotización manual pisa a la de la API.
        const rate = override ?? (reference ? reference.buy : null);
        return { position, rate: rate ?? null, manual: override != null, reference };
      }),
    [positions, rates, overrides],
  );

  const totals = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    let missing = 0;
    for (const item of resolved) {
      if (item.rate == null) {
        missing++;
        continue;
      }
      assets += item.position.assets * item.rate;
      liabilities += item.position.liabilities * item.rate;
    }
    return { assets, liabilities, net: assets - liabilities, missing };
  }, [resolved]);

  // La serie histórica se ancla en el patrimonio de hoy y camina hacia atrás
  // restando el neto de cada mes.
  const series = useMemo(() => {
    if (!monthlyBalances.length) return [];
    const out: { label: string; patrimonio: number }[] = [];
    let running = totals.net;
    for (let i = monthlyBalances.length - 1; i >= 0; i--) {
      out[i] = { label: monthlyBalances[i].label, patrimonio: Math.round(running) };
      running -= monthlyBalances[i].balance;
    }
    return out;
  }, [monthlyBalances, totals.net]);

  const delta = series.length > 1 ? series[series.length - 1].patrimonio - series[0].patrimonio : null;
  const hasForeign = foreign.length > 0;
  const hasBreakdown = hasForeign || positions.length > 1;

  const commitDraft = (currency: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [currency]: value }));
    const parsed = parseRate(value);
    if (parsed !== null) setOverride(currency, parsed);
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Patrimonio neto</p>
            <p className="text-2xl md:text-3xl font-bold font-mono mt-1 text-foreground">
              {formatCurrency(totals.net, "ARS")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {delta != null && (
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                  delta >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                }`}
              >
                {delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span className="money">{formatCurrency(Math.abs(delta), "ARS")}</span> en {monthlyBalances.length} meses
              </div>
            )}
            {hasForeign && (
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={loading}
                aria-label="Actualizar cotizaciones"
                title="Actualizar cotizaciones"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-primary hover:bg-primary/10 disabled:cursor-wait"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            )}
          </div>
        </div>

        {totals.missing > 0 && (
          <p className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            No pudimos traer la cotización de {totals.missing === 1 ? "una moneda" : `${totals.missing} monedas`}. Ingresá
            una manualmente para incluirla en el total.
          </p>
        )}

        {/* Desglose por moneda — plegado: la tarjeta muestra el total y recién
            al pedir detalles aparece la letra chica de cada moneda. */}
        {hasBreakdown && (
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            aria-expanded={showBreakdown}
            className="mb-3 inline-flex h-11 items-center gap-1.5 rounded-lg border border-border px-3.5 text-xs font-semibold text-muted transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Detalles
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${showBreakdown ? "rotate-180" : ""}`}
            />
          </button>
        )}

        {hasBreakdown && showBreakdown && (
          <div className="mb-4 space-y-1.5 rounded-xl border border-border bg-surface-2/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Por moneda</p>
            {resolved.map(({ position, rate, manual, reference }) => {
              const isArs = position.currency === "ARS";
              const converted = rate != null ? position.net * rate : null;
              const isEditing = editing === position.currency;
              return (
                <div key={position.currency} className="rounded-lg py-1.5">
                  <div className="flex items-center gap-3">
                    <span className="w-11 shrink-0 text-xs font-semibold text-foreground">{position.currency}</span>
                    <span className="flex-1 min-w-0 truncate font-mono text-sm text-foreground">
                      {formatCurrency(position.net, position.currency)}
                    </span>
                    {!isArs && (
                      <>
                        <span className="shrink-0 font-mono text-xs text-muted">
                          {converted != null ? formatCurrency(converted, "ARS") : "sin cotización"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditing(isEditing ? null : position.currency)}
                          aria-label={`Editar la cotización de ${position.currency}`}
                          title={`Editar la cotización de ${position.currency}`}
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${
                            manual ? "text-primary" : "text-muted"
                          } hover:bg-surface-3 hover:text-foreground`}
                        >
                          <Pencil size={12} />
                        </button>
                      </>
                    )}
                  </div>

                  {!isArs && (
                    <p className="mt-0.5 pl-14 text-[11px] text-muted">
                      {rate != null ? (
                        <>
                          1 {position.currency} ={" "}
                          <span className="money font-medium text-foreground">
                            {new Intl.NumberFormat("es-AR", {
                              style: "currency",
                              currency: "ARS",
                              maximumFractionDigits: rate < 10 ? 4 : 2,
                            }).format(rate)}
                          </span>{" "}
                          {manual ? "· cotización tuya" : reference ? `· ${reference.source}` : ""}
                        </>
                      ) : loading ? (
                        "Consultando DolarAPI…"
                      ) : (
                        "Sin cotización disponible"
                      )}
                    </p>
                  )}

                  {isEditing && !isArs && (
                    <div className="mt-2 space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
                      <label
                        htmlFor={`nw-rate-${position.currency}`}
                        className="block text-[11px] font-medium text-foreground"
                      >
                        Cotización (ARS por 1 {position.currency})
                      </label>
                      <Input
                        id={`nw-rate-${position.currency}`}
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        inputMode="decimal"
                        placeholder="Ingresá la cotización"
                        value={drafts[position.currency] ?? (rate != null ? String(rate) : "")}
                        onChange={(event) => commitDraft(position.currency, event.target.value)}
                      />
                      {reference && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setOverride(position.currency, reference.buy);
                              setDrafts((prev) => ({ ...prev, [position.currency]: String(reference.buy) }));
                            }}
                            className="rounded-lg border border-success/40 bg-success/10 px-2 py-1.5 text-left"
                          >
                            <span className="block text-[10px] uppercase tracking-wide text-muted">Compra</span>
                            <strong className="money block font-mono text-xs text-foreground">
                              {formatCurrency(reference.buy, "ARS")}
                            </strong>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOverride(position.currency, reference.sell);
                              setDrafts((prev) => ({ ...prev, [position.currency]: String(reference.sell) }));
                            }}
                            className="rounded-lg border border-primary/40 bg-primary/10 px-2 py-1.5 text-left"
                          >
                            <span className="block text-[10px] uppercase tracking-wide text-muted">Venta</span>
                            <strong className="money block font-mono text-xs text-foreground">
                              {formatCurrency(reference.sell, "ARS")}
                            </strong>
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setOverride(position.currency, null);
                            setDrafts((prev) => {
                              const next = { ...prev };
                              delete next[position.currency];
                              return next;
                            });
                          }}
                          disabled={!manual}
                          className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-foreground disabled:opacity-40"
                        >
                          <RotateCcw size={11} /> Volver a la del día
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="text-[11px] font-medium text-primary hover:underline"
                        >
                          Listo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {series.length > 1 && <NetWorthChart data={series} />}
      </CardContent>
    </Card>
  );
}
