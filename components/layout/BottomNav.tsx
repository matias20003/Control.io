"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowUpDown,
  Wallet,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Inicio" },
  { href: "/movimientos", icon: ArrowUpDown,     label: "Movimientos" },
  { href: "/cuentas",     icon: Wallet,          label: "Cuentas" },
  { href: "/inversiones", icon: TrendingUp,      label: "Inversiones" },
  { href: "/configuracion", icon: MoreHorizontal, label: "Más" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-border pb-safe">
      <div className="flex items-center justify-around px-1 py-1">
        {navItems.map((item) => {
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
              <item.icon
                size={21}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
