"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoFull } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useNavArea } from "@/components/layout/useNavArea";
import {
  AREAS, AREA_ORDER, HOME_ITEM, LEGACY_ITEMS, isItemActive, visibleItems, type NavItem,
} from "@/lib/nav";

// Configuración y Cerrar sesión viven en el menú del perfil (Topbar). En
// mobile, Configuración está en "Más" y el logout dentro de Configuración.
export function Sidebar({
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

  const renderItem = (item: NavItem) => {
    const isActive = isItemActive(item, pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted hover:text-foreground hover:bg-surface-2 font-normal",
        )}
      >
        <item.icon size={15} strokeWidth={isActive ? 2.2 : 1.7} className="shrink-0" />
        <span className="truncate">
          {item.href === "/newsletter" && showMyCircle && !isOwner ? "Mi Círculo" : item.label}
        </span>
        {item.href === "/newsletter" && newsletterUnread && !isActive && (
          <span
            className="ml-auto w-2 h-2 rounded-full bg-primary shrink-0"
            title="Tu newsletter de hoy está listo"
          />
        )}
        {isActive && <span className="ml-auto w-1 h-1 rounded-full bg-primary shrink-0" />}
      </Link>
    );
  };

  return (
    <aside className="hidden md:flex flex-col w-56 fixed left-0 top-0 bottom-0 z-30 glass-panel border-r border-r-[color:var(--glass-border)] border-l-0 border-t-0 border-b-0">
      {/* Logo */}
      <div className="px-4 pt-4 pb-3 border-b border-[color:var(--glass-border)]">
        <LogoFull size="sm" tagline />
      </div>

      <nav className="flex-1 px-2.5 py-3 overflow-y-auto">
        {isOwner ? (
          <>
            {/* Inicio cruza los tres pilares, así que vive afuera de ellos. */}
            {renderItem(HOME_ITEM)}

            <div className="mt-3 space-y-1">
              {AREA_ORDER.map((key) => {
                const pillar = AREAS[key];
                const isOpen = key === area;
                return (
                  <div key={key}>
                    {/* El nombre del pilar es a la vez botón y link: abre su
                        lista y lleva a su dashboard. Que sólo se desplegara
                        dejaba la pantalla igual, sin explicar qué pasó. */}
                    <Link
                      href={pillar.home}
                      onClick={() => setArea(key)}
                      aria-expanded={isOpen}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                        isOpen
                          ? "bg-surface-2 text-foreground font-semibold"
                          : "text-muted hover:text-foreground hover:bg-surface-2/60 font-medium",
                      )}
                    >
                      <pillar.icon size={16} strokeWidth={isOpen ? 2.2 : 1.8} className="shrink-0" />
                      <span className="truncate">{pillar.label}</span>
                      <ChevronDown
                        size={14}
                        className={cn(
                          "ml-auto shrink-0 text-muted transition-transform duration-200",
                          isOpen ? "rotate-0" : "-rotate-90",
                        )}
                      />
                    </Link>

                    {isOpen && (
                      // La línea al costado ata visualmente las secciones a su
                      // pilar: sin ella, abierto o cerrado se leían igual.
                      <div className="mt-0.5 ml-4 space-y-0.5 border-l border-border pl-1.5">
                        {visibleItems(pillar.items, isOwner).map(renderItem)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-0.5">
            {visibleItems(LEGACY_ITEMS, isOwner).map(renderItem)}
          </div>
        )}
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
