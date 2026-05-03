"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ArrowUpDown, Wallet, TrendingUp,
  HandCoins, CreditCard, Target, Repeat2, Settings,
  LogOut, PiggyBank, BarChart3, DollarSign, CalendarClock,
  ClipboardList, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoFull } from "@/components/layout/Logo";
import { signOutAction } from "@/app/actions/auth";

const navItems = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Dashboard" },
  { href: "/movimientos",   icon: ArrowUpDown,     label: "Movimientos" },
  { href: "/cuentas",       icon: Wallet,          label: "Cuentas" },
  { href: "/reporte",       icon: ClipboardList,   label: "Reporte semanal" },
  { href: "/tendencias",    icon: BarChart3,       label: "Tendencias" },
  { href: "/agenda",        icon: CalendarClock,   label: "Agenda" },
  { href: "/cotizaciones",  icon: DollarSign,      label: "Cotizaciones" },
  { href: "/inversiones",   icon: TrendingUp,      label: "Inversiones" },
  { href: "/grupos",        icon: Users,           label: "Grupos" },
  { href: "/deudas",        icon: HandCoins,       label: "Deudas" },
  { href: "/cuotas",        icon: CreditCard,      label: "Cuotas" },
  { href: "/presupuestos",  icon: Target,          label: "Presupuestos" },
  { href: "/metas",         icon: PiggyBank,       label: "Metas" },
  { href: "/recurrentes",   icon: Repeat2,         label: "Recurrentes" },
  { href: "/configuracion", icon: Settings,        label: "Configuración" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 fixed left-0 top-0 bottom-0 z-30 bg-surface border-r border-border">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <LogoFull size="md" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
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

      {/* Sign out */}
      <div className="px-2.5 py-3 border-t border-border">
        <form action={signOutAction}>
          <button
            type="submit"
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm w-full",
              "text-muted hover:text-danger hover:bg-danger/8 transition-all duration-150",
              "cursor-pointer font-normal"
            )}
          >
            <LogOut size={15} strokeWidth={1.7} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
