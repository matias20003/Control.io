"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Loader2, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getGoogleStatusAction, disconnectGoogleAction } from "@/app/actions/google";

export function GoogleCalendarCard() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getGoogleStatusAction()
      .then((s) => { setAvailable(s.available); setConnected(s.connected); setEmail(s.email); })
      .finally(() => setLoading(false));
  }, []);

  // Feedback del callback de OAuth (?google=ok / error / denied / unavailable).
  useEffect(() => {
    const g = params.get("google");
    if (!g) return;
    if (g === "ok") toast.success("¡Google conectado! 🎉");
    else if (g === "denied") toast.error("Cancelaste el permiso de Google.");
    else if (g === "norefresh") toast.error("Probá de nuevo y aceptá todos los permisos.");
    else if (g === "unavailable") toast.error("La integración con Google todavía no está disponible.");
    else if (g === "error") toast.error("No se pudo conectar Google. Probá de nuevo.");
  }, [params]);

  const disconnect = async () => {
    setBusy(true);
    const res = await disconnectGoogleAction();
    setBusy(false);
    if ("error" in res) { toast.error(res.error); return; }
    setConnected(false);
    setEmail(null);
    toast.success("Google desconectado");
  };

  // Gateada: no se muestra hasta confirmar que está habilitada para este usuario.
  if (!available) return null;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className={connected ? "text-primary" : "text-muted"} />
          <p className="text-sm font-semibold text-foreground">Google Calendar y Tareas</p>
          {connected && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-success/10 text-success">
              <Check size={12} /> Conectado
            </span>
          )}
        </div>

        <p className="text-xs text-muted">
          Conectá tu Google y deciles al asistente <span className="text-foreground">“agendá turno el jueves 10hs”</span> o
          <span className="text-foreground"> “anotá comprar pan”</span> — lo crea en tu Google Calendar / Tareas.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 size={14} className="animate-spin" /> Cargando…
          </div>
        ) : connected ? (
          <div className="flex flex-wrap items-center gap-3">
            {email && <span className="text-xs text-muted">{email}</span>}
            <button
              onClick={disconnect}
              disabled={busy}
              className="py-2 px-4 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Desconectar
            </button>
          </div>
        ) : (
          <a
            href="/api/google/connect"
            className="inline-flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity"
          >
            <CalendarDays size={15} /> Conectar Google
          </a>
        )}
      </CardContent>
    </Card>
  );
}
