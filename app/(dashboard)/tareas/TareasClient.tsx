"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Check, Trash2, CalendarClock, ListChecks, CalendarDays, Bell, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/stat";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { SerializedTask } from "@/lib/db/tasks";
import type { SerializedReminder } from "@/lib/db/reminders";
import { createTaskAction, toggleTaskAction, deleteTaskAction } from "@/app/actions/tasks";

const ARG_TZ = "America/Argentina/Buenos_Aires";

function fmtEvent(start: string): string {
  if (!start) return "";
  if (!start.includes("T")) {
    const [, m, d] = start.split("-");
    return `${d}/${m} · todo el día`;
  }
  return new Date(start).toLocaleString("es-AR", {
    weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: ARG_TZ,
  });
}

function fmtReminder(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: ARG_TZ,
  });
}

type Props = {
  initialTasks: SerializedTask[];
  reminders: SerializedReminder[];
  events: { id: string; summary: string; start: string }[];
  googleConnected: boolean;
  googleEnabled: boolean;
};

export function TareasClient({ initialTasks, reminders, events, googleConnected, googleEnabled }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [isPending, startTransition] = useTransition();

  const pendientes = tasks.filter((t) => !t.done);
  const hechas = tasks.filter((t) => t.done);

  const add = () => {
    const text = title.trim();
    if (!text) return;
    const fd = new FormData();
    fd.set("title", text);
    if (due) fd.set("dueDate", due);
    startTransition(async () => {
      const res = await createTaskAction(fd);
      if ("error" in res) { toast.error(res.error); return; }
      setTasks((prev) => [res.task, ...prev]);
      setTitle("");
      setDue("");
    });
  };

  const toggle = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    startTransition(async () => {
      const res = await toggleTaskAction(id);
      if ("error" in res) {
        toast.error(res.error);
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
      }
    });
  };

  const remove = (id: string) => {
    const prev = tasks;
    setTasks((p) => p.filter((t) => t.id !== id));
    startTransition(async () => {
      const res = await deleteTaskAction(id);
      if ("error" in res) { toast.error(res.error); setTasks(prev); }
    });
  };

  const Row = ({ t }: { t: SerializedTask }) => {
    const overdue = !t.done && t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString());
    return (
      <div className="flex items-center gap-3 py-2.5">
        <button
          onClick={() => toggle(t.id)}
          aria-label={t.done ? "Marcar pendiente" : "Marcar hecha"}
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${
            t.done ? "border-success bg-success text-white" : "border-border hover:border-primary"
          }`}
        >
          {t.done && <Check size={13} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm truncate ${t.done ? "text-muted line-through" : "text-foreground"}`}>{t.title}</p>
          {t.dueDate && (
            <p className={`text-[11px] inline-flex items-center gap-1 ${overdue ? "text-danger" : "text-muted"}`}>
              <CalendarClock size={11} /> {formatDate(t.dueDate)}{overdue ? " · vencida" : ""}
            </p>
          )}
        </div>
        <button onClick={() => remove(t.id)} className="shrink-0 rounded-lg p-1.5 text-muted hover:text-danger hover:bg-danger/10">
          <Trash2 size={13} />
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-[760px] mx-auto space-y-4">
      <PageHeader title="🗓️ Organización" subtitle="Tu calendario, tareas y recordatorios — todo en un solo lugar." />

      {/* ── Calendario (Google) ────────────────────────────── */}
      {googleEnabled && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays size={16} className="text-primary" />
              <p className="text-sm font-semibold text-foreground">Próximos eventos</p>
              <Link href="/calendario" className="ml-auto text-xs font-medium text-primary hover:underline">Ver calendario →</Link>
            </div>
            {!googleConnected ? (
              <Link
                href="/configuracion"
                className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm transition-colors hover:border-primary/50"
              >
                <span className="flex-1 text-muted">Conectá tu Google Calendar para ver tus eventos acá.</span>
                <ChevronRight size={15} className="shrink-0 text-primary" />
              </Link>
            ) : events.length === 0 ? (
              <p className="text-xs text-muted">No tenés eventos en los próximos 14 días.</p>
            ) : (
              <div className="divide-y divide-border-subtle">
                {events.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <CalendarDays size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{e.summary}</p>
                      <p className="text-[11px] text-muted capitalize">{fmtEvent(e.start)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {googleConnected && (
              <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-xs text-primary hover:underline"
              >
                Abrir Google Calendar →
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Recordatorios ──────────────────────────────────── */}
      {reminders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell size={16} className="text-amber-500" />
              <p className="text-sm font-semibold text-foreground">Recordatorios</p>
            </div>
            <div className="divide-y divide-border-subtle">
              {reminders.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-500">⏰</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{r.text}</p>
                    <p className="text-[11px] text-muted capitalize">{fmtReminder(r.remindAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tareas ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder="Nueva tarea… (ej: Entregar el TP)"
              className="flex-1"
            />
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-40" />
            <Button onClick={add} disabled={isPending || !title.trim()} className="shrink-0">
              <Plus size={16} className="mr-1" /> Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      {tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="Sin tareas" description="Agregá tu primer pendiente arriba." />
      ) : (
        <>
          {pendientes.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted mb-1">Tareas pendientes ({pendientes.length})</p>
                <div className="divide-y divide-border-subtle">
                  {pendientes.map((t) => <Row key={t.id} t={t} />)}
                </div>
              </CardContent>
            </Card>
          )}
          {hechas.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted mb-1">Hechas ({hechas.length})</p>
                <div className="divide-y divide-border-subtle opacity-70">
                  {hechas.map((t) => <Row key={t.id} t={t} />)}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
