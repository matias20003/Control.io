"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getDailyReminderPrefAction, updateDailyReminderPrefAction } from "@/app/actions/notifications";

export function RecordatorioWhatsappCard({ hasWhatsapp }: { hasWhatsapp: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/reminder/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.ok) toast.success(data.message ?? "Enviado");
      else toast.error(data.message ?? data.error ?? "No se pudo enviar");
    } catch {
      toast.error("No se pudo enviar la prueba");
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    getDailyReminderPrefAction()
      .then((res) => {
        if (!("error" in res)) setEnabled(res.enabled);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      const res = await updateDailyReminderPrefAction(next);
      if ("error" in res) {
        toast.error(res.error);
        setEnabled(!next); // revertir si falló
        return;
      }
      toast.success(next ? "Recordatorio diario activado (20:00)" : "Recordatorio diario desactivado");
    } catch {
      toast.error("Error al guardar la preferencia");
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BellRing size={16} className={enabled ? "text-primary" : "text-muted"} />
          <p className="text-sm font-semibold text-foreground">Recordatorio diario</p>
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              enabled ? "bg-success/10 text-success" : "bg-surface-2 text-muted"
            }`}
          >
            {enabled ? "Activo" : "Inactivo"}
          </span>
        </div>

        <p className="text-xs text-muted">
          Todos los días a las <span className="text-foreground">20:00</span> te recordamos registrar tus
          gastos: primero por <span className="text-foreground">WhatsApp</span> y, si no se puede, como
          <span className="text-foreground"> notificación push</span> (nunca por los dos a la vez). Si ya
          cargaste algo ese día, no te molesta.
        </p>

        {!hasWhatsapp ? (
          <p className="text-xs text-muted italic">Vinculá tu número de WhatsApp arriba para poder activarlo.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 size={14} className="animate-spin" /> Cargando preferencia…
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleToggle}
              disabled={saving}
              className={`py-2 px-4 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 ${
                enabled
                  ? "border border-border text-foreground hover:bg-surface-2"
                  : "bg-primary text-white hover:opacity-90"
              }`}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {enabled ? "Desactivar recordatorio" : "Activar recordatorio diario"}
            </button>
            {enabled && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="py-2 px-4 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
                Probar ahora
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
