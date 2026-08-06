"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalValue } from "@/lib/client-store";
import { convertPositions, type CurrencyPosition, type NetWorthTotals } from "@/lib/net-worth";

/**
 * Las cotizaciones con las que se valúa el patrimonio, y el total que sale de
 * ellas.
 *
 * La conversión pasa por acá y no por el servidor por una razón concreta: la
 * cotización se puede editar a mano y ese valor vive en el navegador. Si el
 * servidor convirtiera con la suya, el número editado y el mostrado dejarían de
 * coincidir apenas alguien tocara el dólar.
 *
 * Que las dos pantallas usen este mismo hook es lo que garantiza que muestren
 * el mismo patrimonio.
 */

export const NET_WORTH_OVERRIDES_KEY = "controlio:nw-rates";

export type Rate = {
  currency: string;
  name: string;
  buy: number;
  sell: number;
  updatedAt: string;
  source: string;
};

export type ResolvedPosition = {
  position: CurrencyPosition;
  rate: number | null;
  manual: boolean;
  reference: Rate | null;
};

export function useNetWorthRates(positions: CurrencyPosition[]) {
  const foreign = useMemo(
    () => positions.filter((position) => position.currency !== "ARS").map((position) => position.currency),
    [positions],
  );
  // La lista de monedas cambia poco; la serializamos para usarla como
  // dependencia estable del efecto que trae las cotizaciones.
  const foreignKey = foreign.join(",");

  // Guardamos junto a las cotizaciones la clave del pedido que las trajo. Así
  // "cargando" se deriva (clave pedida ≠ clave cargada) en vez de ser otro
  // estado que haya que sincronizar a mano desde el efecto.
  const [loaded, setLoaded] = useState<{ key: string; rates: Record<string, Rate> } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [overridesRaw, setOverridesRaw] = useLocalValue(NET_WORTH_OVERRIDES_KEY);
  const overrides = useMemo<Record<string, number>>(() => {
    if (!overridesRaw) return {};
    try {
      const parsed = JSON.parse(overridesRaw) as Record<string, unknown>;
      const clean: Record<string, number> = {};
      for (const [currency, value] of Object.entries(parsed)) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) clean[currency] = numeric;
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

  const resolved = useMemo<ResolvedPosition[]>(
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

  const totals: NetWorthTotals = useMemo(() => {
    const effective: Record<string, number> = {};
    for (const item of resolved) {
      if (item.rate != null) effective[item.position.currency] = item.rate;
    }
    return convertPositions(positions, effective);
  }, [positions, resolved]);

  return {
    resolved,
    totals,
    rates,
    overrides,
    setOverride,
    loading,
    hasForeign: foreign.length > 0,
    refresh: () => setRefreshKey((current) => current + 1),
  };
}
