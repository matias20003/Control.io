"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Settings, LogOut, MessageSquarePlus } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";

/**
 * Menú de usuario: avatar con iniciales que despliega Configuración y Cerrar
 * sesión. Pensado para el header mobile (arriba a la derecha).
 *
 * El desplegable se renderiza con un portal a document.body porque el header
 * usa `glass-highlight` (overflow: hidden) y, sin portal, el menú quedaría
 * recortado por el borde del header.
 */
export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera (botón o menú).
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Posición fija debajo del avatar, alineado a la derecha de la pantalla.
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  const initials =
    name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "U";

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Menú de usuario"
        className="w-9 h-9 rounded-xl bg-primary/15 text-primary text-xs font-bold flex items-center justify-center hover:bg-primary/25 transition-colors shrink-0"
      >
        {initials}
      </button>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="w-56 rounded-xl bg-surface border border-border shadow-xl p-1.5 z-[100]"
          >
            <div className="px-2.5 py-2">
              <p className="text-sm font-medium text-foreground truncate">{name}</p>
              <p className="text-xs text-muted truncate">{email}</p>
            </div>
            <div className="h-px bg-border my-1" />
            <Link
              href="/configuracion"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              <Settings size={15} /> Configuración
            </Link>
            <button
              type="button"
              onClick={() => { setOpen(false); window.dispatchEvent(new Event("feedback:open")); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              <MessageSquarePlus size={15} /> Enviar feedback
            </button>
            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted hover:text-danger hover:bg-danger/8 transition-colors cursor-pointer"
              >
                <LogOut size={15} /> Cerrar sesión
              </button>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
