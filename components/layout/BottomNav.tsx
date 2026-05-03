"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ArrowUpDown, Wallet, TrendingUp,
  MoreHorizontal, X, BarChart2, Calendar, DollarSign,
  CreditCard, Target, PiggyBank, Repeat, Settings, BookOpen, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const leftItems = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Inicio" },
  { href: "/movimientos", icon: ArrowUpDown,      label: "Movimientos" },
];

const rightItems = [
  { href: "/grupos",      icon: Users,      label: "Grupos" },
];

const moreItems = [
  { href: "/inversiones",  icon: TrendingUp, label: "Inversiones" },
  { href: "/reporte",      icon: BookOpen,   label: "Reporte semanal" },
  { href: "/tendencias",   icon: BarChart2,  label: "Tendencias" },
  { href: "/agenda",       icon: Calendar,   label: "Agenda" },
  { href: "/cotizaciones", icon: DollarSign, label: "Cotizaciones" },
  { href: "/deudas",       icon: CreditCard, label: "Deudas" },
  { href: "/cuotas",       icon: CreditCard, label: "Cuotas" },
  { href: "/presupuestos", icon: PiggyBank,  label: "Presupuestos" },
  { href: "/metas",        icon: Target,     label: "Metas" },
  { href: "/recurrentes",  icon: Repeat,     label: "Recurrentes" },
  { href: "/configuracion",icon: Settings,   label: "Configuración" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isMoreActive = moreItems.some((i) => pathname.startsWith(i.href));
  const isCuentasActive =
    pathname === "/cuentas" || pathname.startsWith("/cuentas/");

  return (
    <>
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div className="md:hidden fixed left-0 right-0 bottom-[57px] z-50 bg-surface border-t border-border rounded-t-2xl shadow-[0_-8px_32px_oklch(0_0_0/40%)]">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-[0.08em]">
                Más opciones
              </p>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1 px-3 pb-6">
              {moreItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 px-1 py-3.5 rounded-xl transition-all duration-150",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted hover:text-foreground hover:bg-surface-2"
                    )}
                  >
                    <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.7} />
                    <span className="text-[10px] font-medium text-center leading-tight">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Barra inferior */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border pb-safe overflow-visible">
        <div className="grid grid-cols-5 py-1.5">

          {/* Izquierda: Inicio + Movimientos */}
          {leftItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-150",
                  isActive ? "text-primary" : "text-muted"
                )}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.7} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* Centro: Cuentas — FAB elevado */}
          <div className="flex flex-col items-center justify-end pb-2 -translate-y-4">
            <Link href="/cuentas" className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200",
                  "ring-[3px] ring-surface shadow-lg",
                  isCuentasActive
                    ? "bg-primary shadow-[0_4px_20px_oklch(0.67_0.19_258/50%)]"
                    : "bg-primary/80 shadow-[0_4px_16px_oklch(0_0_0/40%)]"
                )}
              >
                <Wallet size={22} strokeWidth={2} className="text-white" />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium leading-tight",
                  isCuentasActive ? "text-primary" : "text-muted"
                )}
              >
                Cuentas
              </span>
            </Link>
          </div>

          {/* Derecha: Grupos */}
          {rightItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-150",
                  isActive ? "text-primary" : "text-muted"
                )}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.7} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* Más */}
          <button
            onClick={() => setOpen(!open)}
            className={cn(
              "flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-150",
              isMoreActive || open ? "text-primary" : "text-muted"
            )}
          >
            <MoreHorizontal size={20} strokeWidth={isMoreActive || open ? 2.2 : 1.7} />
            <span className="text-[10px] font-medium">Más</span>
          </button>

        </div>
      </nav>
    </>
  );
}
