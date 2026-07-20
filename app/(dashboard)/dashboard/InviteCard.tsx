"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Gift, Copy, Check, Send } from "lucide-react";

/**
 * Tarjeta de referidos: convierte a cada usuario en un canal de crecimiento.
 * WhatsApp-native (la app se carga por WhatsApp, así que el usuario invita por
 * el mismo medio). El link lleva ?ref=<userId> para poder atribuir la conversión
 * más adelante (hoy ya sirve para compartir orgánicamente).
 */
export function InviteCard({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://controlio.site/?ref=${userId}`;
  const msg =
    `¡Che! Estoy usando *control.io* para ordenar mis gastos 💸\n\n` +
    `Le hablás por WhatsApp ("gasté 5000 en el súper") y te lo anota solo, sin planillas. ` +
    `Encima te ordena cuentas, presupuestos y metas.\n\n` +
    `Probalo gratis 👉 ${url}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(msg)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible */
    }
  };

  return (
    <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Gift size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            Invitá a un amigo a control.io
          </p>
          <p className="text-xs text-muted mt-0.5 leading-snug">
            Compartí con quien quiera ordenar su plata sin esfuerzo. Cuantos más somos, mejor.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/50"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            {copied ? "Copiado" : "Copiar link"}
          </button>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Send size={14} /> Compartir
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
