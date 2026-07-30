"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Grupos de secciones relacionadas. La barra detecta a qué grupo pertenece la
// ruta actual y muestra esas pestañas.
const GROUPS: { label: string; href: string }[][] = [
  [
    { label: "Presupuestos", href: "/presupuestos" },
    { label: "Metas", href: "/metas" },
    { label: "Gastos fijos", href: "/recurrentes" },
  ],
  [
    { label: "Reporte", href: "/reporte" },
    { label: "Tendencias", href: "/tendencias" },
  ],
];

export function SectionTabs() {
  const pathname = usePathname();
  const group = GROUPS.find((g) => g.some((t) => pathname.startsWith(t.href)));
  if (!group) return null;

  return (
    <div className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-xl bg-surface-2 p-1">
      {group.map((t) => {
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
