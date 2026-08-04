"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ListChecks, MoreHorizontal, Newspaper, Settings, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AreaSwitch } from "@/components/layout/AreaSwitch";
import { useNavArea } from "@/components/layout/useNavArea";
import { AREAS, isItemActive, visibleItems, type NavArea, type NavItem } from "@/lib/nav";

const INICIO: NavItem = { href: "/dashboard", icon: LayoutDashboard, label: "Inicio" };
const CONFIGURACION: NavItem = { href: "/configuracion", icon: Settings, label: "Configuración" };
const MI_BRIEF: NavItem = { href: "/newsletter", icon: Newspaper, label: "Mi Brief" };

/**
 * Los cuatro slots que cambian con el área. Inicio queda fijo en el primero
 * (es el ancla de la app y no pertenece a ninguna de las dos) y "Más" en el
 * último; en el medio va lo más usado de cada área, con el FAB al centro.
 *
 * Lo que no entra acá vive en el sheet "Más": son cinco lugares, no quince.
 */
const MOBILE_BAR: Record<NavArea, { secondary: string; fab: NavItem; fourth: string }> = {
  finanzas: {
    secondary: "/movimientos",
    fab: { href: "/cuentas", icon: Wallet, label: "Cuentas" },
    fourth: "/presupuestos",
  },
  organizacion: {
    secondary: "/hoy",
    fab: { href: "/tareas", icon: ListChecks, label: "Tareas" },
    fourth: "/calendario",
  },
};

export function BottomNav({
  newsletterUnread = false,
  isOwner = false,
  showMyCircle = false,
}: {
  newsletterUnread?: boolean;
  isOwner?: boolean;
  showMyCircle?: boolean;
}) {
  const pathname = usePathname();
  const { area, setArea } = useNavArea();
  const [open, setOpen] = useState(false);

  const areaItems = visibleItems(AREAS[area].items, isOwner);
  const bar = MOBILE_BAR[area];
  const find = (href: string) => areaItems.find((item) => item.href === href);
  // Si el ítem destacado no existiera (por un gate futuro), el slot se cae con
  // elegancia al sheet en vez de romper la barra.
  const secondary = find(bar.secondary);
  const fourth = find(bar.fourth);
  const inBar = new Set([bar.secondary, bar.fab.href, bar.fourth]);

  // El sheet junta lo que no entró en la barra y lo transversal que no es Inicio.
  const more: NavItem[] = [
    ...areaItems.filter((item) => !inBar.has(item.href)),
    MI_BRIEF,
    CONFIGURACION,
  ];

  const labelOf = (item: NavItem) =>
    item.href === "/newsletter" && showMyCircle ? "Mi Círculo" : item.label;

  // Portalizamos el nav directo a document.body. Si algún ancestor del
  // layout queda alguna vez con transform/filter/backdrop-filter,
  // position: fixed se vuelve relativo a ESE ancestor — y la barra
  // empieza a moverse con el scroll. Saliéndonos del árbol garantizamos
  // que el fixed siempre quede anclado al viewport real.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const isMoreActive = more.some((item) => isItemActive(item, pathname));
  const isFabActive = isItemActive(bar.fab, pathname);

  const barLink = (item: NavItem) => {
    const isActive = isItemActive(item, pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex min-h-11 flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-150",
          isActive ? "text-primary" : "text-muted",
        )}
      >
        <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.7} />
        <span className="text-xs font-medium">{labelOf(item)}</span>
      </Link>
    );
  };

  const tree = (
    <>
      {open && (
        <>
          {/* Backdrop — position:fixed inline para que ningún stylesheet lo
              tire al flujo normal (mismo motivo que el nav). zIndex por encima
              del nav (50) para que la barra quede atenuada y no asome. */}
          <div
            className="md:hidden bg-background/70 backdrop-blur-sm animate-sheet-backdrop"
            style={{ position: "fixed", inset: 0, zIndex: 52 }}
            onClick={() => setOpen(false)}
          />

          {/* Sheet — anclado a bottom:0 y por encima del nav (z55). Cubre la
              barra de forma limpia (antes se perchaba con un offset fijo de
              57px que no contemplaba el área segura → se solapaba y cortaba).
              El padding inferior respeta el área segura del gesto/home. */}
          <div
            className="md:hidden bg-surface border-t border-[color:var(--glass-border)] rounded-t-3xl shadow-[0_-10px_40px_oklch(0_0_0/30%)] flex flex-col animate-sheet-up"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 55,
              maxHeight: "85dvh",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
            }}
          >
            {/* Handle de arrastre */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <span className="h-1.5 w-10 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
              <p className="text-sm font-semibold text-foreground">Más opciones</p>
              <button
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* El switch va acá arriba: en celular es el único lugar donde
                entran las dos etiquetas completas sin apretar la barra. */}
            <div className="px-3 pb-3 shrink-0">
              <AreaSwitch area={area} onChange={setArea} size="lg" />
            </div>

            {/* Grid 2×2 balanceado — scrollable si hiciera falta */}
            <div className="overflow-y-auto overscroll-contain px-3 pb-2">
              <div className="grid grid-cols-2 gap-2.5">
                {more.map((item) => {
                  const isActive = isItemActive(item, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-2.5 px-3 py-5 rounded-2xl border transition-all duration-150",
                        isActive
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-surface-2/40 text-muted hover:text-foreground hover:bg-surface-2",
                      )}
                    >
                      <div className="relative">
                        <item.icon size={24} strokeWidth={isActive ? 2.2 : 1.7} />
                        {item.href === "/newsletter" && newsletterUnread && (
                          <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-surface" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-center leading-tight">
                        {labelOf(item)}
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
          rompe el FAB central que necesita sobresalir por arriba. */}
      <nav
        data-bottom-nav="v4"
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

          {/* Inicio queda fijo: es el ancla de la app en las dos áreas. */}
          {barLink(INICIO)}
          {secondary ? barLink(secondary) : <span />}

          {/* Centro: FAB elevado, distinto por área. -translate-y-7 lo levanta
              lo suficiente para que el medio del círculo quede por encima del
              borde superior del zócalo. z-10 + relative aseguran que el
              círculo y su sombra queden por encima del nav, no detrás. */}
          <div className="relative z-10 flex flex-col items-center justify-end pb-2 -translate-y-7">
            <Link href={bar.fab.href} className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200",
                  "ring-[4px] ring-background shadow-lg",
                  isFabActive
                    ? "bg-primary shadow-[0_8px_28px_oklch(0.67_0.19_258/55%)]"
                    : "bg-primary/90 shadow-[0_8px_24px_oklch(0_0_0/45%)]",
                )}
              >
                <bar.fab.icon size={24} strokeWidth={2} className="text-white" />
              </div>
              <span
                className={cn(
                  "text-xs font-medium leading-tight",
                  isFabActive ? "text-primary" : "text-muted",
                )}
              >
                {bar.fab.label}
              </span>
            </Link>
          </div>

          {fourth ? barLink(fourth) : <span />}

          {/* Más */}
          <button
            onClick={() => setOpen(!open)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-150",
              isMoreActive || open ? "text-primary" : "text-muted",
            )}
          >
            <div className="relative">
              <MoreHorizontal size={20} strokeWidth={isMoreActive || open ? 2.2 : 1.7} />
              {newsletterUnread && !open && (
                <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-surface" />
              )}
            </div>
            <span className="text-xs font-medium">Más</span>
          </button>

        </div>
      </nav>
    </>
  );

  if (!mounted) return null;
  return createPortal(tree, document.body);
}
