"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, FileText, Loader2, Mail, MessageCircle, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getReportPrefsAction, updateReportPrefsAction } from "@/app/actions/notifications";
import type { ReportPrefs } from "@/lib/db/profile";

const DAYS = [
  { value: 1, label: "Lunes" }, { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" }, { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" }, { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const selectCls = "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50";
const defaults: ReportPrefs = {
  enabled: false, day: 1, hour: 9, frequency: "WEEKLY",
  notifyApp: true, notifyWhatsapp: true, notifyEmail: false,
};

export function ReporteSemanalCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<ReportPrefs>(defaults);

  useEffect(() => {
    getReportPrefsAction().then((result) => {
      if (!("error" in result)) setPrefs({ ...defaults, ...result });
    }).finally(() => setLoading(false));
  }, []);

  const save = async (next: ReportPrefs) => {
    setSaving(true);
    try {
      const result = await updateReportPrefsAction(next);
      if ("error" in result) {
        toast.error(result.error);
        return false;
      }
      setPrefs(result.prefs);
      toast.success(next.enabled ? "Configuración de reportes guardada" : "Reportes automáticos desactivados");
      return true;
    } catch {
      toast.error("No se pudo guardar la configuración");
      return false;
    } finally {
      setSaving(false);
    }
  };
  const update = (patch: Partial<ReportPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    void save(next);
  };
  const frequencyDay = prefs.frequency === "WEEKLY" ? prefs.day ?? 1
    : prefs.frequency === "FORTNIGHTLY" ? ([1, 15].includes(prefs.day ?? 0) ? prefs.day! : 1)
    : Math.min(28, Math.max(1, prefs.day ?? 1));

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText size={19} /></span>
          <div>
            <p className="text-sm font-semibold text-foreground">Reporte PDF y tendencias</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">Recibí un informe completo con métricas, comparaciones, categorías, movimientos y recomendaciones.</p>
          </div>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${prefs.enabled ? "bg-success/10 text-success" : "bg-surface-2 text-muted"}`}>{prefs.enabled ? "Activo" : "Inactivo"}</span>
        </div>

        {loading ? <p className="flex items-center gap-2 text-xs text-muted"><Loader2 size={14} className="animate-spin" /> Cargando preferencia…</p> : (
          <>
            <button disabled={saving} onClick={() => update({ enabled: !prefs.enabled })}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${prefs.enabled ? "border border-border text-foreground hover:bg-surface-2" : "bg-primary text-white hover:opacity-90"}`}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {prefs.enabled ? "Desactivar reportes" : "Activar reportes"}
            </button>

            {prefs.enabled && <div className="space-y-5 border-t border-border pt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1"><span className="text-xs font-medium text-muted">Frecuencia</span>
                  <select value={prefs.frequency} className={`${selectCls} w-full`} disabled={saving}
                    onChange={(e) => update({ frequency: e.target.value as ReportPrefs["frequency"], day: e.target.value === "WEEKLY" ? 1 : 1 })}>
                    <option value="WEEKLY">Semanal</option><option value="FORTNIGHTLY">Quincenal</option><option value="MONTHLY">Mensual</option>
                  </select>
                </label>
                <label className="space-y-1"><span className="text-xs font-medium text-muted">{prefs.frequency === "WEEKLY" ? "Día de envío" : prefs.frequency === "FORTNIGHTLY" ? "Primer envío" : "Día del mes"}</span>
                  {prefs.frequency === "WEEKLY" ? <select value={frequencyDay} className={`${selectCls} w-full`} disabled={saving} onChange={(e) => update({ day: Number(e.target.value) })}>{DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
                    : prefs.frequency === "FORTNIGHTLY" ? <select value={frequencyDay} className={`${selectCls} w-full`} disabled={saving} onChange={(e) => update({ day: Number(e.target.value) })}><option value={1}>Días 1 y 16</option><option value={15}>Días 15 y 30</option></select>
                    : <select value={frequencyDay} className={`${selectCls} w-full`} disabled={saving} onChange={(e) => update({ day: Number(e.target.value) })}>{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>Día {i + 1}</option>)}</select>}
                </label>
                <label className="space-y-1"><span className="text-xs font-medium text-muted">Horario (Argentina)</span>
                  <select value={prefs.hour ?? 9} className={`${selectCls} w-full`} disabled={saving} onChange={(e) => update({ hour: Number(e.target.value) })}>{HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select>
                </label>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted">Dónde querés recibirlo</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ["notifyApp", "Dentro de la app", Bell],
                    ["notifyWhatsapp", "WhatsApp", MessageCircle],
                    ["notifyEmail", "Email", Mail],
                  ] as const).map(([key, label, Icon]) => (
                    <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-medium ${prefs[key] ? "border-primary/40 bg-primary/5 text-foreground" : "border-border text-muted"}`}>
                      <input type="checkbox" className="accent-primary" checked={prefs[key]} disabled={saving}
                        onChange={(e) => update({ [key]: e.target.checked })} />
                      <Icon size={15} className={prefs[key] ? "text-primary" : ""} /> {label}
                    </label>
                  ))}
                </div>
              </div>
              <p className="flex items-center gap-2 text-[11px] text-muted"><CalendarClock size={13} /> El PDF se genera al cerrar el período y mantiene el estilo claro de Control.io.</p>
            </div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
