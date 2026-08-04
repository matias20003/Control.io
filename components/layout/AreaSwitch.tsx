"use client";

import { CalendarCheck, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { AREAS, type NavArea } from "@/lib/nav";

const ICONS: Record<NavArea, React.ElementType> = {
  finanzas: Wallet,
  organizacion: CalendarCheck,
};

/**
 * Switch entre las dos áreas. Segmentado y con las dos etiquetas siempre a la
 * vista: un toggle de un solo estado obliga a adivinar qué hay del otro lado.
 * La pastilla que se desliza deja claro que es un cambio de contexto y no un
 * botón más del menú.
 */
export function AreaSwitch({
  area,
  onChange,
  size = "sm",
}: {
  area: NavArea;
  onChange: (area: NavArea) => void;
  size?: "sm" | "lg";
}) {
  const areas = Object.keys(AREAS) as NavArea[];
  const index = areas.indexOf(area);

  return (
    <div
      role="tablist"
      aria-label="Área de la aplicación"
      className={cn(
        "relative grid grid-cols-2 rounded-xl border border-border bg-surface-2/60 p-1",
        size === "lg" ? "gap-1" : "gap-0.5",
      )}
    >
      {/* Pastilla activa: una sola, desplazada, para que el cambio se lea como
          movimiento y no como dos botones que se prenden y apagan. */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-lg bg-primary shadow-sm transition-transform duration-200 ease-out"
        style={{
          width: "calc(50% - 0.25rem)",
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {areas.map((key) => {
        const Icon = ICONS[key];
        const isActive = key === area;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors",
              size === "lg" ? "min-h-11 text-sm" : "min-h-9 text-xs",
              isActive ? "text-white" : "text-muted hover:text-foreground",
            )}
          >
            <Icon size={size === "lg" ? 16 : 14} strokeWidth={isActive ? 2.2 : 1.8} />
            {AREAS[key].label}
          </button>
        );
      })}
    </div>
  );
}
