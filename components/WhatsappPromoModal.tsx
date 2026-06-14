"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Mic, Camera, Zap } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// Timestamp de la última vez que mostramos el popup. Vuelve a aparecer cada
// COOLDOWN mientras el usuario siga SIN vincular su número.
export const WA_PROMO_KEY = "wa_promo_shown_at";
const COOLDOWN = 2 * 24 * 60 * 60 * 1000; // 2 días

const BENEFITS = [
  { icon: Mic, text: "Mandá un audio: “gasté 3 lucas en el súper” y se carga solo" },
  { icon: Camera, text: "Sacale una foto al ticket y la IA lo registra" },
  { icon: Zap, text: "Sin abrir la app, desde cualquier lado, en segundos" },
];

export function WhatsappPromoModal({ isLinked }: { isLinked: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLinked) return; // ya vinculó → no lo molestamos más
    let last = 0;
    try { last = Number(localStorage.getItem(WA_PROMO_KEY)) || 0; } catch {}
    if (Date.now() - last < COOLDOWN) return;
    const t = setTimeout(() => { setOpen(true); mark(); }, 2500);
    return () => clearTimeout(t);
  }, [isLinked]);

  const mark = () => {
    try { localStorage.setItem(WA_PROMO_KEY, String(Date.now())); } catch {}
  };
  const dismiss = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); setOpen(o); }}>
      <DialogContent title="Cargá tus gastos por WhatsApp 🤖">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Vinculá tu número y registrá movimientos <span className="text-foreground font-medium">sin abrir la app</span> —
            por texto, audio o foto del ticket. Es la forma más cómoda y la que más se usa.
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

          <a
            href="/configuracion?tab=perfil"
            onClick={dismiss}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle size={16} />
            Vincular mi WhatsApp
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
