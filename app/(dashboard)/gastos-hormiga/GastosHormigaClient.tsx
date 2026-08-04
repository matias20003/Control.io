"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/stat";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { Bug, ChevronDown } from "lucide-react";
import type {
  GastosHormiga,
  MovimientoDetectado,
} from "@/lib/db/gastos-hormiga";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Fecha desconocida"
    : dateFormatter.format(parsed);
}

function MovementList({ movements }: { movements: MovimientoDetectado[] }) {
  return (
    <div className="divide-y divide-border-subtle">
      {movements.map((movement) => {
        const metadata = [
          movement.categoria
            ? `${movement.categoriaIcono ?? ""} ${movement.categoria}`.trim()
            : null,
          movement.cuenta,
        ].filter(Boolean);

        return (
          <div
            key={movement.id}
            className="grid gap-2 px-3 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-4"
          >
            <p className="text-xs font-medium text-muted">
              {formatDate(movement.fecha)}
            </p>
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-foreground">
                {movement.descripcion}
              </p>
              <p className="mt-1 text-xs text-muted">
                {metadata.length > 0
                  ? metadata.join(" · ")
                  : "Sin categoría ni cuenta asignada"}
              </p>
            </div>
            <p className="font-mono text-sm font-semibold text-foreground sm:text-right">
              {formatCurrency(movement.monto, "ARS")}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function GastosHormigaClient({ data }: { data: GastosHormiga }) {
  const {
    suscripciones,
    totalSuscripciones,
    repetidos,
    totalRepetidos,
    periodoMeses,
  } = data;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const nada = suscripciones.length === 0 && repetidos.length === 0;

  const items = [
    ...suscripciones.map((subscription, index) => ({
      id: `subscription-${index}`,
      nombre: subscription.nombre,
      tag: "Suscripción",
      mensual: subscription.montoMensual,
      detalle: `${subscription.veces} cargos en ${periodoMeses} meses`,
      calculation: `Estimamos el valor mensual usando el monto habitual de sus ${subscription.veces} cargos detectados.`,
      observedTotal: subscription.movimientos.reduce(
        (sum, movement) => sum + movement.monto,
        0
      ),
      danger: true,
      movimientos: subscription.movimientos,
    })),
    ...repetidos.map((expense, index) => ({
      id: `ant-expense-${index}`,
      nombre: expense.nombre,
      tag: "Hormiga",
      mensual: Math.round(expense.total / periodoMeses),
      detalle: `${expense.veces} movimientos · ${formatCurrency(
        expense.promedio,
        "ARS"
      )} en promedio`,
      calculation: `Promedio mensual: ${formatCurrency(
        expense.total,
        "ARS"
      )} gastados durante ${periodoMeses} meses, dividido por ese período.`,
      observedTotal: expense.total,
      danger: false,
      movimientos: expense.movimientos,
    })),
  ].sort((a, b) => b.mensual - a.mensual);

  const fugaMensual =
    totalSuscripciones + Math.round(totalRepetidos / periodoMeses);

  return (
    <div className="mx-auto max-w-[760px] space-y-4 p-4 md:p-6">
      {/* La página está gateada por el mismo flag, así que acá la pestaña
          siempre corresponde. */}
      <SectionTabs features={{ gastosHormiga: true }} />
      <PageHeader
        title="🐜 Gastos hormiga"
        subtitle="Dónde se te va la plata sin que te des cuenta."
      />

      {nada ? (
        <EmptyState
          icon={Bug}
          title="Todavía no detecté patrones"
          description="Cargá más movimientos con una descripción clara y voy a poder encontrar suscripciones y gastos repetidos."
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium text-muted">
                Estimación mensual detectada
              </p>
              <p className="mt-1 text-3xl font-bold leading-tight text-danger">
                {formatCurrency(fugaMensual, "ARS")}
                <span className="text-base font-normal text-muted">/mes</span>
              </p>
              <div className="mt-4 grid gap-2 border-t border-border-subtle pt-3 text-xs text-muted sm:grid-cols-2 sm:gap-4">
                <p>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(totalSuscripciones, "ARS")}
                  </span>{" "}
                  en suscripciones
                </p>
                <p>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(
                      Math.round(totalRepetidos / periodoMeses),
                      "ARS"
                    )}
                  </span>{" "}
                  en gastos hormiga
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="border-b border-border-subtle px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Conceptos detectados
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Abrí cada concepto para ver los movimientos y el cálculo.
                </p>
              </div>

              <div className="divide-y divide-border-subtle">
                {items.map((item) => {
                  const expanded = expandedId === item.id;
                  const panelId = `${item.id}-movements`;

                  return (
                    <section key={item.id}>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        onClick={() =>
                          setExpandedId(expanded ? null : item.id)
                        }
                        className="grid min-h-[72px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                              item.danger
                                ? "bg-danger/10 text-danger"
                                : "bg-warning/10 text-warning"
                            }`}
                          >
                            {item.tag}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {item.nombre}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">
                              {item.detalle}
                            </span>
                          </span>
                        </span>

                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-right font-mono text-sm font-bold text-foreground">
                            {formatCurrency(item.mensual, "ARS")}
                            <span className="block text-[10px] font-normal text-muted sm:inline sm:pl-0.5">
                              /mes
                            </span>
                          </span>
                          <ChevronDown
                            size={17}
                            aria-hidden="true"
                            className={`text-muted transition-transform duration-200 ease-out ${
                              expanded ? "rotate-180" : ""
                            }`}
                          />
                        </span>
                      </button>

                      {expanded && (
                        <div
                          id={panelId}
                          role="region"
                          aria-label={`Movimientos de ${item.nombre}`}
                          className="border-t border-border-subtle bg-surface-2/55"
                        >
                          <div className="px-4 py-3">
                            <p className="text-xs leading-relaxed text-muted">
                              {item.calculation}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              Total observado: {" "}
                              <span className="font-semibold text-foreground">
                                {formatCurrency(item.observedTotal, "ARS")}
                              </span>
                            </p>
                          </div>
                          <MovementList movements={item.movimientos} />
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <p className="px-4 text-center text-xs leading-relaxed text-muted">
            Es una estimación basada en descripciones repetidas de los últimos {" "}
            {periodoMeses} meses. Revisá el detalle antes de cancelar o ajustar
            un gasto.
          </p>
        </>
      )}
    </div>
  );
}
