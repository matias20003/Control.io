"use client";

import { useCallback, useEffect, useState } from "react";
import { Laptop, Loader2, MonitorSmartphone, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type DeviceSession = {
  id: string;
  deviceType: string;
  browser: string;
  os: string;
  lastSeenAt: string;
  createdAt: string;
  current: boolean;
};

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 2) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
}

export function DeviceSessionsCard() {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/device-sessions", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setSessions(data.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closeOthers = async () => {
    setClosing(true);
    try {
      const response = await fetch("/api/device-sessions", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "No se pudieron cerrar las sesiones");
        return;
      }
      setSessions((current) => current.filter((session) => session.current));
      toast.success("Se cerraron las demás sesiones");
    } finally {
      setClosing(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MonitorSmartphone size={17} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Dispositivos y sesiones</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Revisá dónde está abierta tu cuenta y cerrá accesos que ya no uses.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border rounded-xl border border-border">
            {sessions.map((session) => {
              const Icon = session.deviceType === "Celular" ? Smartphone : Laptop;
              return (
                <div key={session.id} className="flex items-center gap-3 px-3.5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {session.browser} en {session.os}
                      </p>
                      {session.current && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <ShieldCheck size={11} /> Este dispositivo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      {session.deviceType} · {relativeTime(session.lastSeenAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {sessions.some((session) => !session.current) && (
          <Button
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            onClick={closeOthers}
            disabled={closing}
          >
            {closing && <Loader2 size={15} className="mr-1.5 animate-spin" />}
            {closing ? "Cerrando sesiones..." : "Cerrar las demás sesiones"}
          </Button>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Por seguridad no guardamos tu dirección IP. Los dispositivos aparecen después de volver a usar Control.io.
        </p>
      </CardContent>
    </Card>
  );
}
