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
    { label: "Recurrentes", href: "/recurrentes" },
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
    <div className="flex gap-1 bg-surface-2 rounded-xl p-1 w-fit">
      {group.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
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
