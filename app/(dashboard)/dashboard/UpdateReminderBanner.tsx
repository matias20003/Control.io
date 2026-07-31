"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, X } from "lucide-react";
import {
  NOTICE_ACTION,
  NOTICE_BODY,
  NOTICE_DISMISS,
  NOTICE_ICON,
  NOTICE_ROW,
  NOTICE_TITLE,
} from "@/components/notice";

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
    <div className={NOTICE_ROW}>
      <span className={`${NOTICE_ICON} bg-warning/12 text-warning`}>
        <RefreshCw size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={NOTICE_TITLE}>Hace {days} días que no cargás movimientos</p>
        <p className={NOTICE_BODY}>
          Subí el resumen de tu banco o MercadoPago — solo se agrega lo nuevo.
        </p>
      </div>
      <Link
        href="/movimientos?import=1"
        onClick={dismiss}
        className={`${NOTICE_ACTION} border border-border text-foreground hover:border-primary/50 hover:text-primary`}
      >
        Importar
      </Link>
      <button onClick={dismiss} aria-label="Cerrar" className={NOTICE_DISMISS}>
        <X size={15} />
      </button>
    </div>
  );
}
