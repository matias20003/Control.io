"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowUpDown,
  Wallet,
  TrendingUp,
  HandCoins,
  CreditCard,
  Target,
  Repeat2,
  Settings,
  LogOut,
  PiggyBank,
  BarChart3,
  DollarSign,
  CalendarClock,
  ClipboardList,
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
    <aside className="hidden md:flex flex-col w-60 fixed left-0 top-0 bottom-0 z-30 bg-surface border-r border-border">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <LogoFull />
        <p className="text-[10px] text-muted uppercase tracking-widest mt-1 pl-9">
          systematic efficiency
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/12 text-primary"
                  : "text-muted hover:text-foreground hover:bg-surface-2"
              )}
            >
              <item.icon size={17} strokeWidth={isActive ? 2.5 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-border">
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-danger hover:bg-danger/10 transition-all w-full cursor-pointer"
          >
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
