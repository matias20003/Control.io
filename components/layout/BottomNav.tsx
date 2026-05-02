"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowUpDown,
  Wallet,
  TrendingUp,
  MoreHorizontal,
  X,
  BarChart2,
  Calendar,
  DollarSign,
  CreditCard,
  Target,
  PiggyBank,
  Repeat,
  Settings,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainItems = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Inicio" },
  { href: "/movimientos", icon: ArrowUpDown,      label: "Movimientos" },
  { href: "/cuentas",     icon: Wallet,           label: "Cuentas" },
  { href: "/inversiones", icon: TrendingUp,       label: "Inversiones" },
];

const moreItems = [
  { href: "/reporte-semanal", icon: BookOpen,   label: "Reporte semanal" },
  { href: "/tendencias",      icon: BarChart2,  label: "Tendencias" },
  { href: "/agenda",          icon: Calendar,   label: "Agenda" },
  { href: "/cotizaciones",    icon: DollarSign, label: "Cotizaciones" },
  { href: "/deudas",          icon: CreditCard, label: "Deudas" },
  { href: "/cuotas",          icon: CreditCard, label: "Cuotas" },
  { href: "/presupuestos",    icon: PiggyBank,  label: "Presupuestos" },
  { href: "/metas",           icon: Target,     label: "Metas" },
  { href: "/recurrentes",     icon: Repeat,     label: "Recurrentes" },
  { href: "/configuracion",   icon: Settings,   label: "Configuración" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isMoreActive = moreItems.some((i) => pathname.startsWith(i.href));

  return (
    <>
      {/* Overlay + sheet — solo se monta cuando está abierto */}
      {open && (
        <>
          {/* Fondo oscuro */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setOpen(false)}
          />

          {/* Panel de opciones */}
          <div className="md:hidden fixed left-0 right-0 bottom-[57px] z-50 bg-surface border-t border-border rounded-t-2xl">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="text-sm font-semibold text-foreground">Más opciones</p>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1 px-3 pb-5">
              {moreItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1 px-1 py-3 rounded-xl",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted"
                    )}
                  >
                    <item.icon size={22} strokeWidth={1.8} />
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border pb-safe">
        <div className="flex items-center justify-around px-1 py-1">
          {mainItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[60px]",
                  isActive ? "text-primary" : "text-muted"
                )}
              >
                <item.icon size={21} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setOpen(!open)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[60px]",
              isMoreActive || open ? "text-primary" : "text-muted"
            )}
          >
            <MoreHorizontal size={21} strokeWidth={isMoreActive || open ? 2.5 : 1.8} />
            <span className="text-[10px] font-medium">Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}
