"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ArrowUpDown, Wallet, Target, HandCoins,
  CreditCard, BarChart3, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoFull } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

// Configuración y Cerrar sesión viven en el menú del perfil (Topbar). En
// mobile, Configuración está en "Más" y el logout dentro de Configuración.
const navItems = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Inicio" },
  { href: "/movimientos",   icon: ArrowUpDown,     label: "Movimientos" },
  { href: "/cuentas",       icon: Wallet,          label: "Cuentas" },
  { href: "/presupuestos",  icon: Target,          label: "Planificá", match: ["/presupuestos", "/metas", "/recurrentes"] },
  { href: "/deudas",        icon: HandCoins,       label: "Deudas" },
  { href: "/cuotas",        icon: CreditCard,      label: "Cuotas" },
  { href: "/reporte",       icon: BarChart3,       label: "Análisis", match: ["/reporte", "/tendencias"] },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 fixed left-0 top-0 bottom-0 z-30 glass-panel border-r border-r-[color:var(--glass-border)] border-l-0 border-t-0 border-b-0">
      {/* Logo */}
      <div className="px-4 pt-4 pb-3 border-b border-[color:var(--glass-border)]">
        <LogoFull size="sm" tagline />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.match
            ? item.match.some((m) => pathname.startsWith(m))
            : pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted hover:text-foreground hover:bg-surface-2 font-normal"
              )}
            >
              <item.icon
                size={15}
                strokeWidth={isActive ? 2.2 : 1.7}
                className="shrink-0"
              />
              <span className="truncate">{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1 h-1 rounded-full bg-primary shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Asistente C.io */}
      <div className="px-2.5 pb-4 pt-1 space-y-2.5">
        <a
          href="https://wa.me/5493416041118"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-3 hover:border-primary/50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <MessageCircle size={15} />
            </span>
            <p className="text-xs font-semibold text-foreground leading-tight">¿Dudas con tus finanzas?</p>
          </div>
          <p className="text-[11px] text-muted leading-snug">
            Chateá con <span className="text-primary font-medium">control.io →</span>
          </p>
        </a>

        {/* Cambiar tema claro/oscuro */}
        <ThemeToggle />
      </div>
    </aside>
  );
}
