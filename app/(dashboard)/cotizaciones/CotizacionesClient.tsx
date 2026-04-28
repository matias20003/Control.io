"use client";

import { useState, useEffect, useTransition } from "react";
import { RefreshCw, TrendingUp, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CotizacionItem } from "@/lib/cotizaciones";

interface Props { initial: CotizacionItem[] }

const ICONS: Record<string, string> = {
  oficial:         "🏦",
  blue:            "💵",
  mayorista:       "🏛️",
  bolsa:           "📈",
  contadoconliqui: "💼",
  tarjeta:         "💳",
  cripto:          "🪙",
};

const COLORS: Record<string, string> = {
  oficial:         "#38bdf8",
  blue:            "#22c55e",
  mayorista:       "#818cf8",
  bolsa:           "#f59e0b",
  contadoconliqui: "#fb923c",
  tarjeta:         "#e879f9",
  cripto:          "#f97316",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function CotizacionesClient({ initial }: Props) {
  const [data, setData]       = useState<CotizacionItem[]>(initial);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(initial[0] ? new Date(initial[0].fetchedAt) : null);
  const [isPending, start]    = useTransition();

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const id = setInterval(() => handleRefresh(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  function handleRefresh() {
    start(async () => {
      try {
        const res = await fetch("/api/cotizaciones?refresh=true");
        const json = await res.json();
        if (json.ok && json.data?.length) {
          setData(json.data);
          setLastUpdate(new Date());
        }
      } catch {}
    });
  }

  const blue    = data.find((d) => d.casa === "blue");
  const oficial = data.find((d) => d.casa === "oficial");
  const spread  = blue && oficial ? Math.round(((blue.venta - oficial.venta) / oficial.venta) * 100) : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cotizaciones</h1>
          <p className="text-sm text-muted mt-0.5">
            {lastUpdate
              ? `Actualizado ${lastUpdate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
              : "Datos en tiempo real"}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-surface rounded-xl border border-border hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* Spread card */}
      {spread !== null && (
        <div className="bg-surface rounded-xl border border-border p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Brecha Blue / Oficial</p>
            <p className="text-2xl font-bold text-warning font-mono">+{spread}%</p>
          </div>
          <TrendingUp size={32} className="text-warning opacity-40" />
        </div>
      )}

      {/* All cotizaciones */}
      {data.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-4xl mb-3">📡</p>
          <p>No se pudieron cargar las cotizaciones</p>
          <button onClick={handleRefresh} className="mt-4 text-primary text-sm underline">Reintentar</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.map((c) => (
            <Card key={c.casa} className="relative overflow-hidden">
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                style={{ backgroundColor: COLORS[c.casa] ?? "#94a3b8" }}
              />
              <CardContent className="p-4 pl-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted font-medium uppercase tracking-wide">
                      {ICONS[c.casa] ?? "💲"} {c.nombre}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted mb-0.5">
                      <ArrowDownLeft size={11} className="text-success" /> Compra
                    </div>
                    <p className="text-base font-bold font-mono text-foreground">{fmt(c.compra)}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted mb-0.5">
                      <ArrowUpRight size={11} className="text-danger" /> Venta
                    </div>
                    <p className="text-base font-bold font-mono text-foreground">{fmt(c.venta)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Conversor rápido */}
      {blue && (
        <QuickConverter blue={blue} oficial={oficial} />
      )}

      <p className="text-xs text-muted text-center">
        Fuente: dolarapi.com · Se actualiza automáticamente cada 5 minutos
      </p>
    </div>
  );
}

function QuickConverter({ blue, oficial }: { blue: CotizacionItem; oficial?: CotizacionItem }) {
  const [usd, setUsd] = useState("");
  const arsBlue   = usd ? parseFloat(usd) * blue.venta   : null;
  const arsOficial= usd && oficial ? parseFloat(usd) * oficial.venta : null;

  function fmt(n: number) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Conversor rápido USD → ARS</p>
      <input
        type="number"
        placeholder="Ingresá dólares..."
        value={usd}
        onChange={(e) => setUsd(e.target.value)}
        className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-primary transition-colors font-mono"
      />
      {usd && !isNaN(parseFloat(usd)) && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">💵 Blue (venta)</span>
            <span className="font-mono text-foreground font-semibold">{arsBlue !== null ? fmt(arsBlue) : "-"}</span>
          </div>
          {oficial && arsOficial !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">🏦 Oficial (venta)</span>
              <span className="font-mono text-foreground font-semibold">{fmt(arsOficial)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
