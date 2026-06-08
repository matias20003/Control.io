"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Mic, Zap, Clock } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// Número del bot (solo dígitos, con código de país) para el link click-to-chat.
const BOT_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER;
const CHAT_HREF = BOT_NUMBER
  ? `https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent("Hola! Quiero registrar un movimiento 💸")}`
  : null;

// Flag compartido: una vez que el usuario abre el bot (desde acá o desde
// Configuración), no volvemos a mostrar el popup.
export const WA_PROMO_KEY = "wa_bot_promo_opened";

const BENEFITS = [
  { icon: Mic, text: "Mandá un audio: “gasté 3 lucas en el súper” y se carga solo" },
  { icon: Zap, text: "Texto o voz: la IA lo interpreta y lo registra al instante" },
  { icon: Clock, text: "Sin abrir la app, desde cualquier lado, en segundos" },
];

export function WhatsappPromoModal({ isLinked }: { isLinked: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!CHAT_HREF) return;
    try {
      if (localStorage.getItem(WA_PROMO_KEY) !== "1") setOpen(true);
    } catch {
      // localStorage no disponible (modo incógnito, etc.) → no mostramos.
    }
  }, []);

  if (!CHAT_HREF) return null;

  // Una vez visto (lo cierre como lo cierre), no se muestra más.
  const markSeen = () => {
    try {
      localStorage.setItem(WA_PROMO_KEY, "1");
    } catch {
      // ignore
    }
  };

  const dismiss = () => {
    markSeen();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) markSeen();
        setOpen(o);
      }}
    >
      <DialogContent title="Registrá tus gastos por WhatsApp 🤖">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Ahora podés cargar tus movimientos sin abrir la app. Escribile o mandale un audio al
            asistente y se registra solo.
          </p>

          <ul className="space-y-2.5">
            {BENEFITS.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <b.icon size={15} className="text-primary" />
                </span>
                <span className="text-sm text-foreground">{b.text}</span>
              </li>
            ))}
          </ul>

          {!isLinked && (
            <p className="text-xs text-muted">
              Tip: vinculá tu número en{" "}
              <a href="/configuracion" className="text-primary hover:underline">
                Configuración
              </a>{" "}
              para que el bot te reconozca.
            </p>
          )}

          <a
            href={CHAT_HREF}
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle size={16} />
            Abrir asistente en WhatsApp
          </a>

          <button
            onClick={dismiss}
            className="w-full text-xs text-muted hover:text-foreground transition-colors"
          >
            Más tarde
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
