"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";

/**
 * Menú de usuario: avatar con iniciales que despliega Configuración y Cerrar
 * sesión. Pensado para el header mobile (arriba a la derecha), pero reutilizable.
 */
export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const initials =
    name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "U";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú de usuario"
        className="w-9 h-9 rounded-xl bg-primary/15 text-primary text-xs font-bold flex items-center justify-center hover:bg-primary/25 transition-colors"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface border border-border shadow-xl p-1.5 z-50">
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
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted hover:text-danger hover:bg-danger/8 transition-colors cursor-pointer"
            >
              <LogOut size={15} /> Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
