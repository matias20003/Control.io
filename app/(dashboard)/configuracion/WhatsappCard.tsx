"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { updateWhatsappNumberAction, removeWhatsappNumberAction } from "@/app/actions/whatsapp";
import { WA_PROMO_KEY } from "@/components/WhatsappPromoModal";

// Número del bot (solo dígitos, con código de país) para el link click-to-chat.
const BOT_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER;
const CHAT_HREF = BOT_NUMBER
  ? `https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent("Hola! Quiero registrar un movimiento 💸")}`
  : null;

export function WhatsappCard({ initialNumber }: { initialNumber: string | null }) {
  const [number, setNumber] = useState(initialNumber ?? "");
  const [saved, setSaved] = useState(initialNumber);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!saved && !accepted) {
      toast.error("Tenés que aceptar la política de privacidad para vincular tu número.");
      return;
    }
    setLoading(true);
    try {
      const result = await updateWhatsappNumberAction(new FormData(e.currentTarget));
      if (result?.error) toast.error(result.error);
      else {
        setSaved(result.number ?? null);
        setNumber(result.number ?? "");
        toast.success("Número de WhatsApp vinculado");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      const result = await removeWhatsappNumberAction();
      if (result?.error) toast.error(result.error);
      else {
        setSaved(null);
        setNumber("");
        toast.success("Número desvinculado");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-primary" />
          <p className="text-sm font-semibold text-foreground">Asistente de WhatsApp</p>
        </div>
        <p className="text-xs text-muted">
          Vinculá tu número para registrar gastos e ingresos por WhatsApp con texto o audios.
          Escribile al bot algo como{" "}
          <span className="text-foreground">&ldquo;gasté 5 lucas en el súper&rdquo;</span> y se carga solo.
        </p>

        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp-number">Número (con código de país)</Label>
            <Input
              id="whatsapp-number"
              name="number"
              type="tel"
              inputMode="tel"
              placeholder="54 9 11 1234 5678"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
            />
          </div>
          {!saved && (
            <label className="flex items-start gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
              />
              <span>
                Entiendo que mis mensajes con el asistente se procesan y guardan (encriptados) para
                registrar mis finanzas. Acepto la{" "}
                <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  política de privacidad
                </a>
                .
              </span>
            </label>
          )}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={loading || (!saved && !accepted)}>
              {loading && <Loader2 size={15} className="animate-spin mr-1" />}
              {loading ? "Guardando..." : saved ? "Actualizar" : "Vincular"}
            </Button>
            {saved && (
              <Button type="button" variant="outline" onClick={handleRemove} disabled={loading}>
                Desvincular
              </Button>
            )}
          </div>
        </form>

        {saved && <p className="text-xs text-success">✓ Vinculado a +{saved}</p>}

        {saved && CHAT_HREF && (
          <a
            href={CHAT_HREF}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              try {
                localStorage.setItem(WA_PROMO_KEY, String(Date.now()));
              } catch {
                // ignore
              }
            }}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle size={16} />
            Abrir asistente en WhatsApp
          </a>
        )}
      </CardContent>
    </Card>
  );
}
