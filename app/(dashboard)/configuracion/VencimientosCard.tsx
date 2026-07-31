"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function VencimientosCard() {
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/vencimientos/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.ok) toast.success(data.message ?? "Enviado");
      else toast.error(data.message ?? data.error ?? "No tenés vencimientos próximos");
    } catch {
      toast.error("No se pudo enviar la prueba");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-primary" />
          <p className="text-sm font-semibold text-foreground">Recordatorio de vencimientos</p>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium bg-success/10 text-success">
            Activo
          </span>
        </div>

        <p className="text-xs text-muted">
          Cada mañana te avisamos lo que <span className="text-foreground">vence hoy o mañana</span>: cuotas,
          deudas y gastos fijos. Si tiene una cuenta asignada, te mostramos de dónde se descuenta; si no, te
          indicamos que requiere pago. Llega por notificación push y por WhatsApp si lo tenés vinculado.
        </p>

        <button
          onClick={handleTest}
          disabled={testing}
          className="py-2 px-4 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
          Probar ahora
        </button>
      </CardContent>
    </Card>
  );
}
