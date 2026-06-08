"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ArrowUpDown, Wallet,
  MoreHorizontal, X, BarChart2, CreditCard, Target, HandCoins, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; icon: React.ElementType; label: string; match?: string[] };

const leftItems: NavItem[] = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Inicio" },
  { href: "/movimientos", icon: ArrowUpDown,      label: "Movimientos" },
];

const rightItems: NavItem[] = [
  { href: "/presupuestos", icon: Target, label: "Planificá", match: ["/presupuestos", "/metas", "/recurrentes"] },
];

const moreItems: NavItem[] = [
  { href: "/deudas",       icon: HandCoins,  label: "Deudas" },
  { href: "/cuotas",       icon: CreditCard, label: "Cuotas" },
  { href: "/reporte",      icon: BarChart2,  label: "Análisis", match: ["/reporte", "/tendencias"] },
  { href: "/configuracion",icon: Settings,   label: "Configuración" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Portalizamos el nav directo a document.body. Si algún ancestor del
  // layout queda alguna vez con transform/filter/backdrop-filter,
  // position: fixed se vuelve relativo a ESE ancestor — y la barra
  // empieza a moverse con el scroll. Saliéndonos del árbol garantizamos
  // que el fixed siempre quede anclado al viewport real.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isMoreActive = moreItems.some((i) => (i.match ?? [i.href]).some((m) => pathname.startsWith(m)));
  const isCuentasActive =
    pathname === "/cuentas" || pathname.startsWith("/cuentas/");

  const tree = (
    <>
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div className="md:hidden fixed left-0 right-0 bottom-[57px] z-50 bg-surface/95 backdrop-blur-xl glass-highlight border-t border-[color:var(--glass-border)] rounded-t-2xl shadow-[0_-8px_32px_oklch(0_0_0/40%)] flex flex-col overflow-hidden" style={{ maxHeight: "calc(100dvh - 80px)" }}>
            {/* Header — fijo */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0 border-b border-border/50">
              <p className="text-xs font-semibold text-muted uppercase tracking-[0.08em]">
                Más opciones
              </p>
              <button
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
                className="p-2.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Grid — scrollable */}
            <div className="overflow-y-auto overscroll-contain flex-1 px-2 pt-2 pb-8">
              <div className="grid grid-cols-3 gap-1.5">
                {moreItems.map((item) => {
                  const isActive = (item.match ?? [item.href]).some((m) => pathname.startsWith(m));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-2 px-2 py-4 rounded-xl transition-all duration-150",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted hover:text-foreground hover:bg-surface-2"
                      )}
                    >
                      <item.icon size={22} strokeWidth={isActive ? 2.2 : 1.7} />
                      <span className="text-xs font-medium text-center leading-tight">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Barra inferior — fija al viewport en mobile.
          Pasamos position/inset/zIndex como style inline para que NINGÚN
          stylesheet posterior los pueda sobrescribir, y duplicamos con
          Tailwind para que también funcione en build estática. */}
      {/* IMPORTANTE: NO usar .glass-highlight en este nav. Esa clase agrega
          overflow:hidden para contener su línea decorativa superior — y eso
          rompe el FAB de Cuentas que necesita sobresalir por arriba. */}
      <nav
        data-bottom-nav="v3"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          overflow: "visible",
        }}
        className="md:hidden bg-surface/95 backdrop-blur-xl border-t border-[color:var(--glass-border)] pb-safe"
      >
        <div className="grid grid-cols-5 py-1.5 overflow-visible">

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
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* Centro: Cuentas — FAB elevado. -translate-y-7 lo levanta lo
              suficiente para que el medio del círculo quede por encima del
              borde superior del zócalo. z-10 + relative aseguran que el
              círculo y su sombra queden por encima del nav, no detrás. */}
          <div className="relative z-10 flex flex-col items-center justify-end pb-2 -translate-y-7">
            <Link href="/cuentas" className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200",
                  "ring-[4px] ring-background shadow-lg",
                  isCuentasActive
                    ? "bg-primary shadow-[0_8px_28px_oklch(0.67_0.19_258/55%)]"
                    : "bg-primary/90 shadow-[0_8px_24px_oklch(0_0_0/45%)]"
                )}
              >
                <Wallet size={24} strokeWidth={2} className="text-white" />
              </div>
              <span
                className={cn(
                  "text-xs font-medium leading-tight",
                  isCuentasActive ? "text-primary" : "text-muted"
                )}
              >
                Cuentas
              </span>
            </Link>
          </div>

          {/* Derecha: Grupos */}
          {rightItems.map((item) => {
            const isActive = item.match
              ? item.match.some((m) => pathname.startsWith(m))
              : pathname === item.href || pathname.startsWith(item.href + "/");
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
                <span className="text-xs font-medium">{item.label}</span>
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
            <span className="text-xs font-medium">Más</span>
          </button>

        </div>
      </nav>
    </>
  );

  if (!mounted) return null;
  return createPortal(tree, document.body);
}
