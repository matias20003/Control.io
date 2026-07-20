"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Check, Loader2 } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(b64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

/**
 * Botón compacto para activar notificaciones push desde cualquier lado.
 * Muestra el estado (activadas / bloqueadas / no soportado) y, si hace falta,
 * el botón para pedir permiso + suscribir. Se usa en el recordatorio del
 * newsletter para que el aviso realmente llegue.
 */
export function EnablePushInline() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready
        .then(async (reg) => setSubscribed(!!(await reg.pushManager.getSubscription())))
        .catch(() => {});
    }
  }, []);

  const enable = async () => {
    if (!("serviceWorker" in navigator)) return;
    setEnabling(true);
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== "granted") {
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
      toast.error("No se pudieron activar las notificaciones");
    } finally {
      setEnabling(false);
    }
  };

  if (perm === "unsupported") {
    return (
      <p className="text-xs text-muted">
        Tu navegador no soporta notificaciones push. Vas a ver el aviso igual
        dentro de la app (menú y dashboard).
      </p>
    );
  }

  if (subscribed) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-success">
        <Check size={13} /> Notificaciones activadas en este dispositivo
      </p>
    );
  }

  if (perm === "denied") {
    return (
      <p className="text-xs text-danger leading-relaxed">
        Bloqueaste las notificaciones en el navegador. Tocá el candado en la
        barra de direcciones y habilitalas para recibir el aviso.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={enable}
      disabled={enabling}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {enabling ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Bell size={14} />
      )}
      {enabling ? "Activando…" : "Activar notificaciones"}
    </button>
  );
}
