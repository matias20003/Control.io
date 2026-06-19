"use client";

import { PageHeader, StatCard } from "@/components/ui/stat";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { Bug, Repeat2, TrendingDown } from "lucide-react";
import type { GastosHormiga } from "@/lib/db/gastos-hormiga";

export function GastosHormigaClient({ data }: { data: GastosHormiga }) {
  const { suscripciones, totalSuscripciones, repetidos, totalRepetidos, periodoMeses } = data;
  const nada = suscripciones.length === 0 && repetidos.length === 0;

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto space-y-5">
      <PageHeader
        title="🐜 Gastos hormiga"
        subtitle={`Dónde se te escapa la plata, según tus últimos ${periodoMeses} meses.`}
      />

      {nada ? (
        <EmptyState
          icon={Bug}
          title="Todavía no detecté patrones"
          description="Cuando tengas más movimientos cargados (sobre todo con descripción), voy a poder encontrar suscripciones y gastos repetidos."
        />
      ) : (
        <>
          {/* Hero: el número que importa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              label="En suscripciones (estimado)"
              value={`${formatCurrency(totalSuscripciones, "ARS")}/mes`}
              hint={`${suscripciones.length} cargo${suscripciones.length !== 1 ? "s" : ""} recurrente${suscripciones.length !== 1 ? "s" : ""}`}
              icon={Repeat2}
              accent="danger"
            />
            <StatCard
              label={`En gastos repetidos (${periodoMeses} meses)`}
              value={formatCurrency(totalRepetidos, "ARS")}
              hint={`${repetidos.length} grupo${repetidos.length !== 1 ? "s" : ""} de gasto frecuente`}
              icon={TrendingDown}
              accent="warning"
            />
          </div>

          {/* Suscripciones */}
          {suscripciones.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Repeat2 size={16} className="text-danger" />
                  <p className="text-sm font-semibold text-foreground">Posibles suscripciones</p>
                </div>
                <p className="text-xs text-muted mb-4">
                  Cargos que se repiten todos los meses con un monto parecido. ¿Las usás todas?
                </p>
                <div className="divide-y divide-border-subtle">
                  {suscripciones.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.nombre}</p>
                        <p className="text-xs text-muted">{s.veces}× en los últimos {periodoMeses} meses</p>
                      </div>
                      <p className="text-sm font-bold font-mono text-danger shrink-0">
                        {formatCurrency(s.montoMensual, "ARS")}/mes
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gastos repetidos / hormiga */}
          {repetidos.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Bug size={16} className="text-warning" />
                  <p className="text-sm font-semibold text-foreground">Gastos hormiga</p>
                </div>
                <p className="text-xs text-muted mb-4">
                  Cosas chicas que repetís seguido y, sumadas, se llevan una parte importante.
                </p>
                <div className="divide-y divide-border-subtle">
                  {repetidos.map((g, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{g.nombre}</p>
                        <p className="text-xs text-muted">{g.veces}× · {formatCurrency(g.promedio, "ARS")} c/u</p>
                      </div>
                      <p className="text-sm font-bold font-mono text-warning shrink-0">
                        {formatCurrency(g.total, "ARS")}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted text-center px-4">
            Es una estimación a partir de las descripciones de tus movimientos. Revisá cada uno —
            cancelar lo que no usás puede ahorrarte más de lo que sale control.io. 💡
          </p>
        </>
      )}
    </div>
  );
}
