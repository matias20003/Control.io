"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer;
}

async function getOrCreateSubscription(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  return sub;
}

export function PushProvider() {
  const [status, setStatus] = useState<"idle" | "subscribed" | "denied" | "unsupported">("idle");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    // Registrar service worker
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const perm = Notification.permission;
      if (perm === "denied") { setStatus("denied"); return; }

      if (perm === "granted") {
        const sub = await getOrCreateSubscription(reg);
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sub.toJSON()),
          }).catch(() => {});
          setStatus("subscribed");
        }
      }
    }).catch(() => {});
  }, []);

  async function enable() {
    if (!("serviceWorker" in navigator)) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { setStatus("denied"); return; }

    const reg = await navigator.serviceWorker.ready;
    const sub = await getOrCreateSubscription(reg);
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      }).catch(() => {});
      setStatus("subscribed");
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
    }
    setStatus("idle");
  }

  if (status === "unsupported") return null;

  return (
    <div className="flex items-center gap-2">
      {status === "subscribed" ? (
        <button
          onClick={disable}
          title="Desactivar notificaciones"
          className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
        >
          <Bell size={16} />
        </button>
      ) : status === "denied" ? (
        <button
          title="Notificaciones bloqueadas en el navegador"
          className="p-2 rounded-lg text-muted cursor-not-allowed"
          disabled
        >
          <BellOff size={16} />
        </button>
      ) : (
        <button
          onClick={enable}
          title="Activar notificaciones"
          className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <BellOff size={16} />
        </button>
      )}
    </div>
  );
}
