"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import {
  NOTICE_ACTION,
  NOTICE_BODY,
  NOTICE_DISMISS,
  NOTICE_ICON,
  NOTICE_ROW,
  NOTICE_TITLE,
} from "@/components/notice";

// Número del bot de control.io (mismo que el del sidebar).
const BOT_WA = "5493416041118";

/**
 * Aviso de onboarding WhatsApp-first para quien todavía no vinculó su número.
 * Empuja el comportamiento que más engancha (los usuarios de WhatsApp: 100% de
 * retención y 30× más movimientos). Vincular es en 1 TOQUE: abre WhatsApp con
 * "Vincular <code>" listo y el bot captura el número real (cero tipeo).
 * Desaparece una vez vinculado.
 */
export function WhatsappOnboardingHero({ linkCode }: { linkCode: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const oneTapHref = `https://wa.me/${BOT_WA}?text=${encodeURIComponent(`Vincular ${linkCode}`)}`;

  return (
    <div className={NOTICE_ROW}>
      <span className={`${NOTICE_ICON} bg-primary/12 text-primary`}>
        <MessageCircle size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={NOTICE_TITLE}>Cargá tus gastos por WhatsApp</p>
        <p className={NOTICE_BODY}>
          Escribís, mandás un audio o la foto de un ticket, y se registra solo.
        </p>
      </div>
      <a
        href={oneTapHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`${NOTICE_ACTION} bg-primary text-white hover:opacity-90`}
      >
        Vincular
      </a>
      <button onClick={() => setHidden(true)} aria-label="Ocultar" className={NOTICE_DISMISS}>
        <X size={15} />
      </button>
    </div>
  );
}
