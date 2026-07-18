"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2, SendHorizonal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(b64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

export function NotificacionesCard() {
  const [permStatus, setPermStatus] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermStatus("unsupported");
      return;
    }
    setPermStatus(Notification.permission);
    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready
        .then(async (reg) => {
          const sub = await reg.pushManager.getSubscription();
          setSubscribed(!!sub);
        })
        .catch(() => {});
    }
  }, []);

  const handleEnable = async () => {
    if (!("serviceWorker" in navigator)) return;
    setEnabling(true);
    try {
      const perm = await Notification.requestPermission();
      setPermStatus(perm);
      if (perm !== "granted") {
        toast.error("Permiso denegado");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setSubscribed(true);
      toast.success("Notificaciones activadas");
    } catch {
      toast.error("Error al activar notificaciones");
    } finally {
      setEnabling(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "🔔 Prueba de control.io",
          body: "Las notificaciones están funcionando correctamente.",
        }),
      });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else toast.success("Notificación enviada — revisá tu dispositivo");
    } catch {
      toast.error("Error al enviar la notificación");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          {subscribed ? <Bell size={16} className="text-primary" /> : <BellOff size={16} className="text-muted" />}
          <p className="text-sm font-semibold text-foreground">Notificaciones push</p>
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              subscribed
                ? "bg-success/10 text-success"
                : permStatus === "denied"
                ? "bg-danger/10 text-danger"
                : "bg-surface-2 text-muted"
            }`}
          >
            {subscribed ? "Activas" : permStatus === "denied" ? "Bloqueadas" : "Inactivas"}
          </span>
        </div>

        <p className="text-xs text-muted">
          Recibí alertas de presupuesto, gastos fijos y vencimientos directamente en tu dispositivo.
        </p>

        {permStatus === "unsupported" && (
          <p className="text-xs text-warning">Tu navegador no soporta notificaciones push.</p>
        )}

        {permStatus === "denied" && (
          <p className="text-xs text-danger">
            Bloqueaste las notificaciones en el navegador. Para activarlas, hacé clic en el candado en la barra de direcciones y habilitá notificaciones manualmente.
          </p>
        )}

        {permStatus !== "unsupported" && permStatus !== "denied" && (
          <div className="flex gap-2">
            {!subscribed && (
              <button
                onClick={handleEnable}
                disabled={enabling}
                className="flex-1 py-2 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {enabling ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                {enabling ? "Activando..." : "Activar notificaciones"}
              </button>
            )}
            {subscribed && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex-1 py-2 px-4 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <SendHorizonal size={14} />}
                {testing ? "Enviando..." : "Enviar notificación de prueba"}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
