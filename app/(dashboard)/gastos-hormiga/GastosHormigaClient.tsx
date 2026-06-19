"use client";

import { PageHeader } from "@/components/ui/stat";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { Bug } from "lucide-react";
import type { GastosHormiga } from "@/lib/db/gastos-hormiga";

export function GastosHormigaClient({ data }: { data: GastosHormiga }) {
  const { suscripciones, totalSuscripciones, repetidos, totalRepetidos, periodoMeses } = data;
  const nada = suscripciones.length === 0 && repetidos.length === 0;

  // Una sola lista priorizada por impacto MENSUAL: suscripciones tal cual,
  // gastos hormiga prorrateados al mes. Así se ataca primero lo que más cuesta.
  const items = [
    ...suscripciones.map((s) => ({
      nombre: s.nombre,
      tag: "Suscripción",
      mensual: s.montoMensual,
      detalle: `${s.veces}× en ${periodoMeses}m`,
      danger: true,
    })),
    ...repetidos.map((g) => ({
      nombre: g.nombre,
      tag: "Hormiga",
      mensual: Math.round(g.total / periodoMeses),
      detalle: `${g.veces}× · ${formatCurrency(g.promedio, "ARS")} c/u`,
      danger: false,
    })),
  ].sort((a, b) => b.mensual - a.mensual);

  const fugaMensual = totalSuscripciones + Math.round(totalRepetidos / periodoMeses);

  return (
    <div className="p-4 md:p-6 max-w-[760px] mx-auto space-y-4">
      <PageHeader title="🐜 Gastos hormiga" subtitle="Dónde se te va la plata sin que te des cuenta." />

      {nada ? (
        <EmptyState
          icon={Bug}
          title="Todavía no detecté patrones"
          description="Cargá más movimientos (con descripción) y voy a poder encontrar suscripciones y gastos repetidos."
        />
      ) : (
        <>
          {/* Un solo número que importa */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted">Se te escapan, por mes, aprox.</p>
              <p className="text-3xl font-bold text-danger leading-tight">
                {formatCurrency(fugaMensual, "ARS")}
                <span className="text-base font-normal text-muted">/mes</span>
              </p>
              <p className="text-xs text-muted mt-1">
                {formatCurrency(totalSuscripciones, "ARS")} en suscripciones · {formatCurrency(Math.round(totalRepetidos / periodoMeses), "ARS")} en gastos hormiga
              </p>
            </CardContent>
          </Card>

          {/* Lista priorizada compacta */}
          <Card>
            <CardContent className="p-2">
              <div className="divide-y divide-border-subtle">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-2 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          it.danger ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
                        }`}
                      >
                        {it.tag}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{it.nombre}</p>
                        <p className="text-[11px] text-muted">{it.detalle}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold font-mono text-foreground shrink-0">
                      {formatCurrency(it.mensual, "ARS")}<span className="text-[11px] text-muted font-normal">/mes</span>
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted text-center px-4">
            Estimación según tus descripciones. Cancelá lo que no uses — suele ahorrar más de lo que sale la app. 💡
          </p>
        </>
      )}
    </div>
  );
}
