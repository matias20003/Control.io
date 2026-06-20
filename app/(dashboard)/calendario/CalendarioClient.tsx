"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Loader2, Check } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { SerializedTask } from "@/lib/db/tasks";
import { createCalendarEventAction, updateCalendarEventAction, deleteCalendarEventAction } from "@/app/actions/calendar";
import { createTaskAction, toggleTaskAction, deleteTaskAction } from "@/app/actions/tasks";

export type CalItem = { id: string | null; label: string; time: string; kind: "event" | "task" | "reminder" };
export type Cell = { key: string; dayNum: number; inMonth: boolean; items: CalItem[] };

const DOT = { event: "bg-primary", task: "bg-success", reminder: "bg-amber-500" } as const;
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function prettyDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const wd = date.toLocaleDateString("es-AR", { weekday: "long", timeZone: "UTC" });
  return `${wd} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

type Form = { mode: "create" | "edit"; id?: string; title: string; day: string; time: string };

export function CalendarioClient({
  cells, initialTasks, monthLabel, todayArg, prevMonth, nextMonth, googleConnected, googleEnabled,
}: {
  cells: Cell[];
  initialTasks: SerializedTask[];
  monthLabel: string;
  todayArg: string;
  prevMonth: string;
  nextMonth: string;
  googleConnected: boolean;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const initial =
    cells.find((c) => c.key === todayArg && c.inMonth)?.key ??
    cells.find((c) => c.inMonth)?.key ??
    cells[0]?.key ?? "";
  const [selected, setSelected] = useState(initial);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedCell = cells.find((c) => c.key === selected);

  // ── Eventos ──────────────────────────────────────────────
  const openCreate = (day: string) => setForm({ mode: "create", title: "", day, time: "09:00" });
  const openEdit = (it: CalItem, day: string) => {
    if (it.kind !== "event" || !it.id) return;
    setForm({ mode: "edit", id: it.id, title: it.label, day, time: it.time || "09:00" });
  };
  const save = async () => {
    if (!form) return;
    setSaving(true);
    const res = form.mode === "create"
      ? await createCalendarEventAction({ title: form.title, day: form.day, time: form.time })
      : await updateCalendarEventAction({ id: form.id!, title: form.title, day: form.day, time: form.time });
    setSaving(false);
    if ("error" in res) { toast.error(res.error); return; }
    toast.success(form.mode === "create" ? "Evento creado ✓" : "Evento actualizado ✓");
    setForm(null);
    router.refresh();
  };
  const del = async () => {
    if (!form?.id) return;
    setSaving(true);
    const res = await deleteCalendarEventAction(form.id);
    setSaving(false);
    if ("error" in res) { toast.error(res.error); return; }
    toast.success("Evento borrado");
    setForm(null);
    router.refresh();
  };

  // ── Tareas ───────────────────────────────────────────────
  const [tasks, setTasks] = useState(initialTasks);
  const [tTitle, setTTitle] = useState("");
  const [tDue, setTDue] = useState("");
  const [isPending, startTransition] = useTransition();
  const pendientes = tasks.filter((t) => !t.done);
  const hechas = tasks.filter((t) => t.done);

  const addTask = () => {
    const text = tTitle.trim();
    if (!text) return;
    const fd = new FormData();
    fd.set("title", text);
    if (tDue) fd.set("dueDate", tDue);
    startTransition(async () => {
      const res = await createTaskAction(fd);
      if ("error" in res) { toast.error(res.error); return; }
      setTasks((p) => [res.task, ...p]);
      setTTitle("");
      setTDue("");
      router.refresh();
    });
  };
  const toggleTask = (id: string) => {
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    startTransition(async () => {
      const res = await toggleTaskAction(id);
      if ("error" in res) { toast.error(res.error); setTasks((p) => p.map((t) => (t.id === id ? { ...t, done: !t.done } : t))); return; }
      router.refresh();
    });
  };
  const removeTask = (id: string) => {
    const prev = tasks;
    setTasks((p) => p.filter((t) => t.id !== id));
    startTransition(async () => {
      const res = await deleteTaskAction(id);
      if ("error" in res) { toast.error(res.error); setTasks(prev); return; }
      router.refresh();
    });
  };

  const TaskRow = ({ t }: { t: SerializedTask }) => {
    const overdue = !t.done && t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString());
    return (
      <div className="flex items-center gap-3 py-2.5">
        <button
          onClick={() => toggleTask(t.id)}
          aria-label={t.done ? "Marcar pendiente" : "Marcar hecha"}
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${t.done ? "border-success bg-success text-white" : "border-border hover:border-primary"}`}
        >
          {t.done && <Check size={13} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm truncate ${t.done ? "text-muted line-through" : "text-foreground"}`}>{t.title}</p>
          {t.dueDate && (
            <p className={`text-[11px] ${overdue ? "text-danger" : "text-muted"}`}>{formatDate(t.dueDate)}{overdue ? " · vencida" : ""}</p>
          )}
        </div>
        <button onClick={() => removeTask(t.id)} className="shrink-0 rounded-lg p-1.5 text-muted hover:text-danger hover:bg-danger/10">
          <Trash2 size={13} />
        </button>
      </div>
    );
  };

  const navBtn = "rounded-lg border border-border p-1.5 text-muted hover:text-foreground transition-colors";
  const navTxt = "rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors";

  return (
    <div className="p-3 md:p-6 max-w-[1100px] mx-auto space-y-3">
      {/* Barra superior */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg md:text-xl font-bold text-foreground capitalize">{monthLabel}</h1>
        <div className="flex items-center gap-1.5">
          <Link href="/calendario" className={navTxt}>Hoy</Link>
          <Link href={`/calendario?month=${prevMonth}`} className={navBtn} aria-label="Mes anterior"><ChevronLeft size={16} /></Link>
          <Link href={`/calendario?month=${nextMonth}`} className={navBtn} aria-label="Mes siguiente"><ChevronRight size={16} /></Link>
        </div>
      </div>

      {!googleConnected && googleEnabled && (
        <Link href="/configuracion" className="block rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-muted hover:border-primary/50">
          Conectá tu Google Calendar para ver y crear eventos acá →
        </Link>
      )}

      {/* Cabecera de días */}
      <div className="grid grid-cols-7 text-center text-[10px] md:text-[11px] font-semibold text-muted">
        {DIAS.map((d, i) => <div key={i} className="py-1">{d}</div>)}
      </div>

      {/* Grilla */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {cells.map((c) => {
          const isToday = c.key === todayArg;
          const isSel = c.key === selected;
          return (
            <button
              key={c.key}
              onClick={() => setSelected(c.key)}
              className={`text-left bg-surface p-1 md:p-1.5 min-h-[52px] md:min-h-[96px] transition-colors ${c.inMonth ? "" : "opacity-40"} ${isSel ? "ring-2 ring-inset ring-primary" : "hover:bg-surface-2/50"}`}
            >
              <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${isToday ? "bg-primary text-white" : "text-muted"}`}>
                {c.dayNum}
              </span>
              <div className="mt-0.5 hidden md:block space-y-0.5">
                {c.items.slice(0, 3).map((it, i) => (
                  <div key={i} className="flex items-center gap-1 truncate text-[10px] text-foreground" title={`${it.time} ${it.label}`}>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[it.kind]}`} />
                    <span className="truncate">{it.time && <span className="text-muted">{it.time} </span>}{it.label}</span>
                  </div>
                ))}
                {c.items.length > 3 && <p className="text-[10px] text-muted">+{c.items.length - 3} más</p>}
              </div>
              {c.items.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5 md:hidden">
                  {c.items.slice(0, 4).map((it, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${DOT[it.kind]}`} />)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Lista del día seleccionado */}
      {selectedCell && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground capitalize">{prettyDay(selectedCell.key)}</p>
              {googleConnected && (
                <Button size="sm" onClick={() => openCreate(selectedCell.key)}><Plus size={15} className="mr-1" /> Evento</Button>
              )}
            </div>
            {selectedCell.items.length === 0 ? (
              <p className="py-1 text-sm text-muted">Nada agendado este día.</p>
            ) : (
              <div className="divide-y divide-border-subtle">
                {selectedCell.items.map((it, i) => (
                  <button key={i} disabled={it.kind !== "event"} onClick={() => openEdit(it, selectedCell.key)} className="flex w-full items-center gap-3 py-2.5 text-left enabled:hover:opacity-80 disabled:cursor-default">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[it.kind]}`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{it.time && <span className="text-muted">{it.time} · </span>}{it.label}</span>
                    {it.kind === "event" && <Pencil size={14} className="shrink-0 text-muted" />}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tareas ── */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={tTitle}
              onChange={(e) => setTTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }}
              placeholder="Nueva tarea… (ej: Entregar el TP)"
              className="flex-1"
            />
            <Input type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} className="sm:w-40" />
            <Button onClick={addTask} disabled={isPending || !tTitle.trim()} className="shrink-0"><Plus size={16} className="mr-1" /> Agregar</Button>
          </div>
        </CardContent>
      </Card>

      {pendientes.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-1 text-xs font-semibold text-muted">Tareas pendientes ({pendientes.length})</p>
            <div className="divide-y divide-border-subtle">{pendientes.map((t) => <TaskRow key={t.id} t={t} />)}</div>
          </CardContent>
        </Card>
      )}
      {hechas.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-1 text-xs font-semibold text-muted">Hechas ({hechas.length})</p>
            <div className="divide-y divide-border-subtle opacity-70">{hechas.map((t) => <TaskRow key={t.id} t={t} />)}</div>
          </CardContent>
        </Card>
      )}

      {/* Card crear/editar evento */}
      <Dialog open={!!form} onOpenChange={(o) => { if (!o) setForm(null); }}>
        <DialogContent title={form?.mode === "edit" ? "Editar evento" : "Nuevo evento"}>
          {form && (
            <div className="space-y-3">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="¿Qué es? (ej: Turno médico)" autoFocus />
              <div className="flex gap-2">
                <Input type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className="flex-1" />
                <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-28" />
              </div>
              <div className="flex gap-2 pt-1">
                {form.mode === "edit" && <Button variant="danger" onClick={del} disabled={saving} aria-label="Borrar"><Trash2 size={15} /></Button>}
                <Button variant="ghost" className="flex-1" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button>
                <Button className="flex-1" onClick={save} disabled={saving || !form.title.trim()}>
                  {saving ? <Loader2 size={15} className="animate-spin" /> : "Guardar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
