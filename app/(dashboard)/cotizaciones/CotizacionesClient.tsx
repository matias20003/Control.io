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

const FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", BRL: "🇧🇷", CLP: "🇨🇱", UYU: "🇺🇾",
};

function fmt(n: number, min = 2) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: min, maximumFractionDigits: 2 }).format(n);
}

export function CotizacionesClient({ initial }: Props) {
  const [data, setData] = useState<CotizacionItem[]>(initial);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(initial[0] ? new Date(initial[0].fetchedAt) : null);
  const [isPending, start] = useTransition();

  // Auto-refresh cada 3 minutos para que se sienta "en vivo".
  useEffect(() => {
    const id = setInterval(() => handleRefresh(), 3 * 60 * 1000);
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

  const usd = data.filter((d) => d.moneda === "USD");
  const otras = data.filter((d) => d.moneda !== "USD");
  const blue = usd.find((d) => d.casa === "blue");
  const oficial = usd.find((d) => d.casa === "oficial");
  const spread = blue && oficial ? Math.round(((blue.venta - oficial.venta) / oficial.venta) * 100) : null;

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cotizaciones</h1>
          <p className="text-sm text-muted mt-0.5 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            {lastUpdate
              ? `En vivo · ${lastUpdate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
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

      {data.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-4xl mb-3">📡</p>
          <p>No se pudieron cargar las cotizaciones</p>
          <button onClick={handleRefresh} className="mt-4 text-primary text-sm underline">Reintentar</button>
        </div>
      ) : (
        <>
          {/* Destacados: oficial + blue grandes */}
          {(oficial || blue) && (
            <div className="grid grid-cols-2 gap-3">
              {oficial && <BigCard item={oficial} />}
              {blue && <BigCard item={blue} />}
            </div>
          )}

          {/* Brecha */}
          {spread !== null && (
            <div className="bg-surface rounded-xl border border-border p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted uppercase tracking-wider mb-1">Brecha Blue / Oficial</p>
                <p className="text-2xl font-bold text-warning font-mono">+{spread}%</p>
              </div>
              <TrendingUp size={32} className="text-warning opacity-40" />
            </div>
          )}

          {/* Resto de tipos de dólar */}
          {usd.filter((c) => c.casa !== "oficial" && c.casa !== "blue").length > 0 && (
            <Section title="Otros tipos de dólar">
              {usd.filter((c) => c.casa !== "oficial" && c.casa !== "blue").map((c) => (
                <RateCard key={`${c.moneda}-${c.casa}`} item={c} icon={ICONS[c.casa] ?? "💲"} color={COLORS[c.casa]} />
              ))}
            </Section>
          )}

          {/* Otras monedas */}
          {otras.length > 0 && (
            <Section title="Otras monedas">
              {otras.map((c) => (
                <RateCard key={`${c.moneda}-${c.casa}`} item={c} icon={FLAGS[c.moneda] ?? "💱"} color="#94a3b8" />
              ))}
            </Section>
          )}

          {/* Conversor */}
          {blue && <QuickConverter blue={blue} oficial={oficial} />}
        </>
      )}

      <p className="text-xs text-muted text-center">
        Fuente: dolarapi.com · Se actualiza automáticamente cada 3 minutos
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/** Card grande y destacada (oficial / blue). */
function BigCard({ item }: { item: CotizacionItem }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: COLORS[item.casa] ?? "#94a3b8" }} />
      <CardContent className="p-4 pl-5">
        <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-2">
          {ICONS[item.casa] ?? "💲"} Dólar {item.nombre}
        </p>
        <p className="text-2xl md:text-3xl font-bold font-mono text-foreground leading-none">{fmt(item.venta, 0)}</p>
        <p className="text-xs text-muted mt-1.5">Compra {fmt(item.compra, 0)}</p>
      </CardContent>
    </Card>
  );
}

/** Card estándar (otros tipos / otras monedas). */
function RateCard({ item, icon, color }: { item: CotizacionItem; icon: string; color?: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color ?? "#94a3b8" }} />
      <CardContent className="p-4 pl-5">
        <p className="text-xs text-muted font-medium uppercase tracking-wide mb-3">{icon} {item.nombre}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1 text-xs text-muted mb-0.5">
              <ArrowDownLeft size={11} className="text-success" /> Compra
            </div>
            <p className="text-base font-bold font-mono text-foreground">{fmt(item.compra)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-muted mb-0.5">
              <ArrowUpRight size={11} className="text-danger" /> Venta
            </div>
            <p className="text-base font-bold font-mono text-foreground">{fmt(item.venta)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickConverter({ blue, oficial }: { blue: CotizacionItem; oficial?: CotizacionItem }) {
  const [usd, setUsd] = useState("");
  const n = parseFloat(usd);
  const arsBlue = usd && !isNaN(n) ? n * blue.venta : null;
  const arsOficial = usd && !isNaN(n) && oficial ? n * oficial.venta : null;

  function f(x: number) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(x);
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Conversor rápido USD → ARS</p>
      <input
        type="number"
        inputMode="decimal"
        placeholder="Ingresá dólares..."
        value={usd}
        onChange={(e) => setUsd(e.target.value)}
        className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-primary transition-colors font-mono"
      />
      {arsBlue !== null && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">💵 Blue (venta)</span>
            <span className="font-mono text-foreground font-semibold">{f(arsBlue)}</span>
          </div>
          {arsOficial !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">🏦 Oficial (venta)</span>
              <span className="font-mono text-foreground font-semibold">{f(arsOficial)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
