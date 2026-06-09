"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getReportPrefsAction, updateReportPrefsAction } from "@/app/actions/notifications";

// Lunes primero; el value es el de Date.getDay() (0=Domingo).
const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const fmtHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

const selectCls =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50";

export function ReporteSemanalCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [day, setDay] = useState<number>(1); // Lunes por defecto
  const [hour, setHour] = useState<number>(9); // 09:00 por defecto

  useEffect(() => {
    getReportPrefsAction()
      .then((res) => {
        if ("error" in res) return;
        setEnabled(res.enabled);
        if (res.day != null) setDay(res.day);
        if (res.hour != null) setHour(res.hour);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async (next: { enabled: boolean; day: number; hour: number }) => {
    setSaving(true);
    try {
      const res = await updateReportPrefsAction({
        enabled: next.enabled,
        day: next.enabled ? next.day : null,
        hour: next.enabled ? next.hour : null,
      });
      if ("error" in res) {
        toast.error(res.error);
        return false;
      }
      toast.success(
        next.enabled
          ? `Reporte semanal: ${DAYS.find((d) => d.value === next.day)?.label} a las ${fmtHour(next.hour)}`
          : "Reporte semanal desactivado",
      );
      return true;
    } catch {
      toast.error("Error al guardar la preferencia");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    const ok = await save({ enabled: next, day, hour });
    if (!ok) setEnabled(!next); // revertir si falló
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className={enabled ? "text-primary" : "text-muted"} />
          <p className="text-sm font-semibold text-foreground">Reporte semanal por email</p>
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              enabled ? "bg-success/10 text-success" : "bg-surface-2 text-muted"
            }`}
          >
            {enabled ? "Activo" : "Inactivo"}
          </span>
        </div>

        <p className="text-xs text-muted">
          Recibí un resumen de tus ingresos, gastos y ahorro de la semana en tu email, el día y horario que elijas.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 size={14} className="animate-spin" /> Cargando preferencia…
          </div>
        ) : (
          <>
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
              {enabled ? "Desactivar reporte" : "Activar reporte semanal"}
            </button>

            {enabled && (
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">Día</span>
                  <select
                    value={day}
                    disabled={saving}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setDay(v);
                      save({ enabled: true, day: v, hour });
                    }}
                    className={selectCls}
                  >
                    {DAYS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">Hora</span>
                  <select
                    value={hour}
                    disabled={saving}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setHour(v);
                      save({ enabled: true, day, hour: v });
                    }}
                    className={selectCls}
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {fmtHour(h)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
