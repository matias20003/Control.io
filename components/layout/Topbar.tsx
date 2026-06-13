"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, ChevronDown, Settings, LogOut, Calculator as CalcIcon, MessageSquarePlus } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";

/**
 * Topbar — barra superior compartida (solo desktop). En mobile sigue el Header.
 * Buscador global + accesos (alertas / ayuda) + menú de usuario con logout.
 */
export function Topbar({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
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
    <header className="hidden md:flex items-center gap-3 sticky top-0 z-20 h-16 px-6 bg-background/80 backdrop-blur-xl border-b border-[color:var(--glass-border)]">
      <div className="flex-1" />

      {/* Buscador global */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/buscar?q=${encodeURIComponent(q.trim())}`);
        }}
        className="relative w-full max-w-xs"
      >
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en todo…"
          className="w-full h-9 pl-9 pr-3 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
        />
      </form>

      {/* Calculadora */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("calculator:open"))}
        title="Calculadora (C)"
        className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors shrink-0"
      >
        <CalcIcon size={16} />
      </button>

      {/* Alertas */}
      <Link
        href="/reporte"
        title="Alertas y novedades"
        className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors shrink-0"
      >
        <Bell size={16} />
      </Link>

      {/* Menú de usuario */}
      <div ref={ref} className="relative shrink-0">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-xl bg-surface border border-border hover:bg-surface-2 transition-colors"
        >
          <span className="w-6 h-6 rounded-lg bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
            {initials}
          </span>
          <span className="text-sm font-medium text-foreground max-w-[140px] truncate">{name}</span>
          <ChevronDown size={14} className="text-muted" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-60 rounded-xl bg-surface border border-border shadow-xl p-1.5 z-30">
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
          </div>
        )}
      </div>
    </header>
  );
}
