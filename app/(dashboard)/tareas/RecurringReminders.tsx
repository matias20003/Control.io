"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Repeat, Plus, Trash2, Clock, Link2, Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  createRecurringReminderAction,
  updateRecurringReminderAction,
  toggleRecurringReminderAction,
  deleteRecurringReminderAction,
} from "@/app/actions/recurring-reminders";
import type { SerializedRecurringReminder } from "@/lib/db/recurring-reminders";

// getDay: 0=Dom … 6=Sáb. Mostramos la semana arrancando en Lunes.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LETTER: Record<number, string> = { 0: "D", 1: "L", 2: "M", 3: "M", 4: "J", 5: "V", 6: "S" };
const DAY_SHORT: Record<number, string> = {
  0: "Dom", 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb",
};

const PRESETS: { label: string; days: number[] }[] = [
  { label: "Todos los días", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "Lun a Vie", days: [1, 2, 3, 4, 5] },
  { label: "Fin de semana", days: [0, 6] },
];

function sameDays(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((d) => s.has(d));
}

function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  for (const p of PRESETS) if (sameDays(sorted, p.days)) return p.label;
  return DAY_ORDER.filter((d) => sorted.includes(d)).map((d) => DAY_SHORT[d]).join(", ");
}

function fmtTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function RecurringReminders({
  initial,
}: {
  initial: SerializedRecurringReminder[];
}) {
  const [items, setItems] = useState<SerializedRecurringReminder[]>(initial);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [time, setTime] = useState("09:00");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const resetForm = () => {
    setText("");
    setLink("");
    setDays([1, 2, 3, 4, 5]);
    setTime("09:00");
    setEditingId(null);
  };

  const startEdit = (r: SerializedRecurringReminder) => {
    setEditingId(r.id);
    setText(r.text);
    setLink(r.link ?? "");
    setDays(r.daysOfWeek);
    setTime(fmtTime(r.hour, r.minute));
  };

  const save = () => {
    const t = text.trim();
    if (!t) {
      toast.error("Escribí el mensaje del recordatorio");
      return;
    }
    if (days.length === 0) {
      toast.error("Elegí al menos un día");
      return;
    }
    const [hh, mm] = time.split(":").map(Number);
    const payload = { text: t, link: link.trim() || undefined, daysOfWeek: days, hour: hh, minute: mm };
    start(async () => {
      if (editingId) {
        const res = await updateRecurringReminderAction(editingId, payload);
        if (res.error) toast.error(res.error);
        else {
          setItems((prev) =>
            prev.map((i) =>
              i.id === editingId ? { ...i, text: t, link: link.trim() || null, daysOfWeek: days, hour: hh, minute: mm } : i
            )
          );
          resetForm();
          toast.success("Recordatorio actualizado");
        }
      } else {
        const res = await createRecurringReminderAction(payload);
        if (res.error) toast.error(res.error);
        else if (res.success && res.reminder) {
          setItems((prev) => [...prev, res.reminder!]);
          resetForm();
          toast.success("Recordatorio recurrente creado");
        }
      }
    });
  };

  const toggle = (id: string, isActive: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isActive } : i)));
    toggleRecurringReminderAction(id, isActive).then((res) => {
      if (res.error) {
        toast.error(res.error);
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isActive: !isActive } : i)));
      }
    });
  };

  const remove = (id: string) => {
    const prev = items;
    setItems((p) => p.filter((i) => i.id !== id));
    deleteRecurringReminderAction(id).then((res) => {
      if (res.error) {
        toast.error(res.error);
        setItems(prev);
      }
    });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Repeat size={16} className="text-primary" />
          <p className="text-sm font-semibold text-foreground">Recordatorios recurrentes</p>
        </div>
        <p className="text-xs text-muted -mt-2">
          Que te avise siempre, ej: “Cargar los gastos del día” todos los días de
          lunes a viernes a las 21:00. Llega por WhatsApp (o notificación).
        </p>

        {/* Form */}
        <div className="rounded-xl border border-border bg-surface-2/40 p-3.5 space-y-3">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mensaje del recordatorio…"
            maxLength={200}
          />

          {/* Link opcional — se manda junto al recordatorio, tocable en WhatsApp */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 h-11">
            <Link2 size={15} className="text-muted shrink-0" />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link opcional (ej. asistencia)… se manda en el recordatorio"
              inputMode="url"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
            />
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const active = sameDays(days, p.days);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDays(p.days)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "bg-surface-2 text-muted hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Días individuales — grilla para que nunca desborde en mobile */}
          <div className="grid grid-cols-7 gap-1">
            {DAY_ORDER.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  aria-label={DAY_SHORT[d]}
                  className={`h-9 rounded-lg text-xs font-semibold transition-colors ${
                    on
                      ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                      : "bg-surface-2 text-muted hover:text-foreground"
                  }`}
                >
                  {DAY_LETTER[d]}
                </button>
              );
            })}
          </div>

          {/* Hora + agregar — apilado en mobile, en línea desde sm */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 h-11 shrink-0">
              <Clock size={15} className="text-muted shrink-0" />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-transparent text-sm text-foreground outline-none [color-scheme:dark]"
              />
            </div>
            <Button onClick={save} disabled={isPending} className="w-full sm:flex-1">
              {editingId ? <Check size={16} className="mr-1" /> : <Plus size={16} className="mr-1" />}
              {isPending ? "Guardando…" : editingId ? "Guardar cambios" : "Crear recordatorio"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} disabled={isPending} className="shrink-0">
                <X size={16} className="mr-1" /> Cancelar
              </Button>
            )}
          </div>
        </div>

        {/* Lista */}
        {items.length > 0 && (
          <div className="divide-y divide-border-subtle">
            {items.map((r) => (
              <div key={r.id} className={`flex items-center gap-3 py-2.5 ${editingId === r.id ? "rounded-lg bg-primary/5 -mx-1 px-1" : ""}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Repeat size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium truncate ${
                      r.isActive ? "text-foreground" : "text-muted line-through"
                    }`}
                  >
                    {r.text}
                  </p>
                  <p className="text-[11px] text-muted">
                    {daysLabel(r.daysOfWeek)} · {fmtTime(r.hour, r.minute)}
                    {r.link && (
                      <span className="inline-flex items-center gap-0.5 ml-1.5 text-primary">
                        <Link2 size={11} /> con link
                      </span>
                    )}
                  </p>
                </div>
                <label className="shrink-0 cursor-pointer" title={r.isActive ? "Activo" : "Pausado"}>
                  <input
                    type="checkbox"
                    checked={r.isActive}
                    onChange={(e) => toggle(r.id, e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
                <button
                  onClick={() => startEdit(r)}
                  className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-primary/10 hover:text-primary transition-colors"
                  aria-label="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => remove(r.id)}
                  className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                  aria-label="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
