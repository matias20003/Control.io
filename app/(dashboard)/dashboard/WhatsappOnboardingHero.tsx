"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Mic, Camera, X, ArrowRight } from "lucide-react";

// Número del bot de control.io (mismo que el del sidebar).
const BOT_WA = "5493416041118";
const HELLO = encodeURIComponent("Hola! Quiero empezar a cargar mis gastos 👋");

/**
 * Hero de onboarding WhatsApp-first: lo más prominente del dashboard para quien
 * todavía no vinculó su número. Empuja el comportamiento que más engancha
 * (los usuarios de WhatsApp cargan 13× más). Desaparece una vez vinculado.
 */
export function WhatsappOnboardingHero() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 md:p-5">
      <button
        onClick={() => setHidden(true)}
        aria-label="Ocultar"
        className="absolute right-2 top-2 rounded-lg p-1.5 text-muted hover:bg-surface-2"
      >
        <X size={15} />
      </button>

      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary">
          <MessageCircle size={18} />
        </span>
        <div>
          <p className="text-sm font-bold text-foreground">Cargá tus gastos por WhatsApp</p>
          <p className="text-xs text-muted">La forma más fácil — y la que hace que de verdad la uses.</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-foreground/90">
        Contale tus gastos a nuestro asistente: escribís <span className="font-medium">"gasté 3000 en el súper"</span>,
        le mandás un <span className="font-medium">audio</span> o la <span className="font-medium">foto de un ticket</span>.
        Él los registra solo.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> Texto</span>
        <span className="inline-flex items-center gap-1"><Mic size={13} /> Audio</span>
        <span className="inline-flex items-center gap-1"><Camera size={13} /> Foto</span>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/configuracion?tab=perfil"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Vincular mi WhatsApp <ArrowRight size={15} />
        </Link>
        <a
          href={`https://wa.me/${BOT_WA}?text=${HELLO}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          <MessageCircle size={15} /> Escribirle al bot
        </a>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Tip: primero vinculá tu número así el asistente te reconoce.
      </p>
    </div>
  );
}
