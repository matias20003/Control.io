"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { FeatureFlag } from "@/lib/feature-flags";

type Tab = { label: string; href: string; flag?: FeatureFlag };

// Grupos de secciones relacionadas. La barra detecta a qué grupo pertenece la
// ruta actual y muestra esas pestañas.
const GROUPS: Tab[][] = [
  [
    { label: "Presupuestos", href: "/presupuestos" },
    { label: "Metas", href: "/metas" },
    { label: "Movimientos fijos", href: "/recurrentes" },
  ],
  [
    { label: "Reporte", href: "/reporte" },
    { label: "Tendencias", href: "/tendencias" },
    { label: "Gastos hormiga", href: "/gastos-hormiga", flag: "gastosHormiga" },
  ],
];

/**
 * Las pestañas con `flag` solo aparecen si la página las habilita.
 *
 * El estado del flag se resuelve en el server (necesita saber si la cuenta es
 * tester) y baja por prop. El default es no mostrarlas: una pestaña visible
 * hacia una sección que después rebota al inicio es peor que no tenerla.
 */
export function SectionTabs({
  features,
}: {
  features?: Partial<Record<FeatureFlag, boolean>>;
} = {}) {
  const pathname = usePathname();
  const group = GROUPS.find((g) => g.some((t) => pathname.startsWith(t.href)));
  if (!group) return null;

  const visible = group.filter((t) => !t.flag || features?.[t.flag]);

  return (
    <div className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-xl bg-surface-2 p-1">
      {visible.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex min-h-11 shrink-0 items-center px-4 py-2 rounded-lg text-sm font-medium transition-all md:min-h-0",
              active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
