"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpDown, LayoutDashboard, MoreHorizontal, Settings, Target, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AREAS, AREA_ORDER, HOME_ITEM, LEGACY_ITEMS, isItemActive, visibleItems, type NavItem,
} from "@/lib/nav";

const CONFIGURACION: NavItem = { href: "/configuracion", icon: Settings, label: "Configuración" };

// ── Barra de siempre (todos los usuarios) ──
// Los tres pilares están en prueba y sólo los ve el dueño; el resto sigue con
// la barra que ya tiene aprendida.
const LEGACY_LEFT: NavItem[] = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Inicio" },
  { href: "/movimientos", icon: ArrowUpDown,     label: "Movimientos" },
];
const LEGACY_RIGHT: NavItem[] = [
  { href: "/presupuestos", icon: Target, label: "Planificá", match: ["/presupuestos", "/metas", "/recurrentes"] },
];
const LEGACY_FAB: NavItem = { href: "/cuentas", icon: Wallet, label: "Cuentas" };
/** Lo que no entra en los cinco lugares de la barra vive en el sheet "Más". */
const LEGACY_BAR = new Set(["/dashboard", "/movimientos", "/cuentas", "/presupuestos"]);

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
  const [open, setOpen] = useState(false);

  const labelOf = (item: NavItem) =>
    item.href === "/newsletter" && showMyCircle && !isOwner ? "Mi Círculo" : item.label;

  // El sheet del dueño agrupa por pilar; el de siempre es una lista sola.
  const groups = isOwner
    ? AREA_ORDER.map((key) => ({
        key: key as string,
        label: AREAS[key].label,
        // El dashboard del pilar ya está en la barra: repetirlo sería ruido.
        items: visibleItems(AREAS[key].items, isOwner).filter((item) => item.href !== AREAS[key].home),
      }))
    : [{
        key: "legacy",
        label: "",
        items: visibleItems(LEGACY_ITEMS, isOwner).filter((item) => !LEGACY_BAR.has(item.href)),
      }];

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

  const sheetItems = [...groups.flatMap((group) => group.items), CONFIGURACION];
  const isMoreActive = sheetItems.some((item) => isItemActive(item, pathname));

  const fab = isOwner ? HOME_ITEM : LEGACY_FAB;
  const isFabActive = isOwner ? pathname === HOME_ITEM.href : isItemActive(LEGACY_FAB, pathname);

  const barLink = (item: NavItem, badge = false) => {
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
        <div className="relative">
          <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.7} />
          {badge && (
            <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-surface" />
          )}
        </div>
        <span className="text-xs font-medium">{labelOf(item)}</span>
      </Link>
    );
  };

  /** Un pilar queda marcado cuando estás en su dashboard o en cualquier sección suya. */
  const pillarLink = (key: (typeof AREA_ORDER)[number]) => {
    const pillar = AREAS[key];
    const isActive = visibleItems(pillar.items, isOwner).some((item) => isItemActive(item, pathname));
    return (
      <Link
        key={key}
        href={pillar.home}
        className={cn(
          "flex min-h-11 flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-150",
          isActive ? "text-primary" : "text-muted",
        )}
      >
        <div className="relative">
          <pillar.icon size={20} strokeWidth={isActive ? 2.2 : 1.7} />
          {key === "circulo" && newsletterUnread && (
            <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-surface" />
          )}
        </div>
        <span className="text-xs font-medium">{pillar.label}</span>
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

            {/* Grid 2×2 balanceado — scrollable si hiciera falta */}
            <div className="overflow-y-auto overscroll-contain px-3 pb-2">
              {groups.map((group) => (
                <section key={group.key} className="mb-4 last:mb-0">
                  {group.label && (
                    <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                      {group.label}
                    </h2>
                  )}
                  <div className="grid grid-cols-2 gap-2.5">
                    {group.items.map((item) => (
                      <SheetLink
                        key={item.href}
                        item={item}
                        label={labelOf(item)}
                        isActive={isItemActive(item, pathname)}
                        badge={item.href === "/newsletter" && newsletterUnread}
                        onNavigate={() => setOpen(false)}
                      />
                    ))}
                  </div>
                </section>
              ))}
              <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-3">
                <SheetLink
                  item={CONFIGURACION}
                  label={CONFIGURACION.label}
                  isActive={isItemActive(CONFIGURACION, pathname)}
                  badge={false}
                  onNavigate={() => setOpen(false)}
                />
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
        data-bottom-nav="v5"
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

          {isOwner
            ? [pillarLink("finanzas"), pillarLink("organizacion")]
            : LEGACY_LEFT.map((item) => barLink(item))}

          {/* Centro: FAB elevado. -translate-y-7 lo levanta lo suficiente para
              que el medio del círculo quede por encima del borde superior del
              zócalo. z-10 + relative aseguran que el círculo y su sombra
              queden por encima del nav, no detrás. */}
          <div className="relative z-10 flex flex-col items-center justify-end pb-2 -translate-y-7">
            <Link href={fab.href} className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200",
                  "ring-[4px] ring-background shadow-lg",
                  isFabActive
                    ? "bg-primary shadow-[0_8px_28px_oklch(0.67_0.19_258/55%)]"
                    : "bg-primary/90 shadow-[0_8px_24px_oklch(0_0_0/45%)]",
                )}
              >
                <fab.icon size={24} strokeWidth={2} className="text-white" />
              </div>
              <span
                className={cn(
                  "text-xs font-medium leading-tight",
                  isFabActive ? "text-primary" : "text-muted",
                )}
              >
                {fab.label}
              </span>
            </Link>
          </div>

          {isOwner
            ? pillarLink("circulo")
            : LEGACY_RIGHT.map((item) => barLink(item))}

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
              {/* En el menú del dueño el aviso ya se ve en Mi Círculo. */}
              {newsletterUnread && !open && !isOwner && (
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

function SheetLink({ item, label, isActive, badge, onNavigate }: {
  item: NavItem;
  label: string;
  isActive: boolean;
  badge: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex flex-col items-center gap-2.5 px-3 py-5 rounded-2xl border transition-all duration-150",
        isActive
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-surface-2/40 text-muted hover:text-foreground hover:bg-surface-2",
      )}
    >
      <div className="relative">
        <item.icon size={24} strokeWidth={isActive ? 2.2 : 1.7} />
        {badge && (
          <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-surface" />
        )}
      </div>
      <span className="text-sm font-medium text-center leading-tight">{label}</span>
    </Link>
  );
}
