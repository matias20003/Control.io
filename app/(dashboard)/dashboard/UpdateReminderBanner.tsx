"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, X } from "lucide-react";

// Recuerda que hace tiempo que el usuario no carga movimientos y lo invita a
// subir el resumen. Aparece a partir de los 5 días y no insiste antes de 2 días.
const KEY = "control:update-reminder-at";
const MIN_DAYS = 5;
const COOLDOWN = 2 * 24 * 60 * 60 * 1000;

export function UpdateReminderBanner({ days }: { days: number | null }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (days == null || days < MIN_DAYS) return;
    let last = 0;
    try { last = Number(localStorage.getItem(KEY)) || 0; } catch {}
    if (Date.now() - last < COOLDOWN) return;
    setShow(true);
  }, [days]);

  if (!show || days == null) return null;

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
  };

  return (
    <div className="relative flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <RefreshCw size={18} className="shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          Hace {days} días que no cargás movimientos
        </p>
        <p className="text-xs text-muted">
          Subí el resumen de MercadoPago o tu banco para ponerte al día — solo se agrega lo nuevo.
        </p>
      </div>
      <Link
        href="/movimientos?import=1"
        onClick={dismiss}
        className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
      >
        Importar
      </Link>
      <button
        onClick={dismiss}
        aria-label="Cerrar"
        className="shrink-0 rounded-lg p-1 text-muted hover:bg-surface-2"
      >
        <X size={15} />
      </button>
    </div>
  );
}
