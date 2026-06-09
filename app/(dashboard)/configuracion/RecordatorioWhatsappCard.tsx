"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getDailyReminderPrefAction, updateDailyReminderPrefAction } from "@/app/actions/notifications";

export function RecordatorioWhatsappCard({ hasWhatsapp }: { hasWhatsapp: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);

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
          Todos los días a las <span className="text-foreground">20:00</span> el asistente te escribe por
          WhatsApp para recordarte registrar tus gastos. Si ya cargaste algo ese día, no te molesta.
        </p>

        {!hasWhatsapp ? (
          <p className="text-xs text-muted italic">Vinculá tu número de WhatsApp arriba para poder activarlo.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 size={14} className="animate-spin" /> Cargando preferencia…
          </div>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
