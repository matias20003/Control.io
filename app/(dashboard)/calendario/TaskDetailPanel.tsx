"use client";

/**
 * Panel de detalle de una tarea. Se desliza desde la derecha en escritorio y
 * sube desde abajo en celular, así la lista sigue a la vista mientras se edita.
 *
 * Es el único lugar donde se pueden tocar todos los campos de una tarea, y por
 * eso también es lo que hace utilizable la vista de Prioridades: urgente e
 * importante no se podían marcar desde ningún lado.
 */
import { useState, useTransition } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { AlertTriangle, RefreshCw, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { OrganizationTask } from "@/lib/db/organization";

export type TaskList = { id: string; name: string; color: string };

const TZ = "America/Argentina/Buenos_Aires";
/** Argentina no tiene horario de verano, así que el offset es fijo. */
const ARG_OFFSET = "-03:00";

const PRIORITIES = [
  { value: "NONE", label: "Ninguna", tone: "text-muted" },
  { value: "LOW", label: "Baja", tone: "text-primary" },
  { value: "MEDIUM", label: "Media", tone: "text-amber-500" },
  { value: "HIGH", label: "Alta", tone: "text-danger" },
] as const;

const REMINDERS = [
  { value: "", label: "Sin recordatorio" },
  { value: "0", label: "A la hora exacta" },
  { value: "10", label: "10 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "1440", label: "1 día antes" },
];

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const timeKey = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

export type TaskPatch = Partial<OrganizationTask> & {
  dueDate?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </div>
  );
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

function TaskForm({
  task,
  lists,
  onSave,
  onDelete,
  onRetrySync,
  onClose,
}: {
  task: OrganizationTask;
  lists: TaskList[];
  onSave: (patch: TaskPatch) => void;
  onDelete: () => void;
  onRetrySync: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [day, setDay] = useState(task.scheduledStart ? dayKey(task.scheduledStart) : task.dueDate ? dayKey(task.dueDate) : "");
  const [time, setTime] = useState(task.scheduledStart ? timeKey(task.scheduledStart) : "");
  const [listId, setListId] = useState(task.listId ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [urgent, setUrgent] = useState(task.urgent);
  const [important, setImportant] = useState(task.important);
  const [reminder, setReminder] = useState(task.reminderMinutes == null ? "" : String(task.reminderMinutes));
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const save = () => {
    if (!title.trim()) return;
    // Sin día no hay nada que agendar; con día y hora se agenda (y va a Google),
    // con día solo queda como vencimiento.
    const scheduledStart = day && time ? new Date(`${day}T${time}:00${ARG_OFFSET}`).toISOString() : null;
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      dueDate: day ? new Date(`${day}T12:00:00${ARG_OFFSET}`).toISOString() : null,
      scheduledStart,
      scheduledEnd: scheduledStart ? new Date(Date.parse(scheduledStart) + 3_600_000).toISOString() : null,
      listId: listId || null,
      priority,
      urgent,
      important,
      reminderMinutes: reminder === "" ? null : Number(reminder),
    });
  };

  return (
    <>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4 sm:px-6">
        <Field label="Tarea">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
            placeholder="¿Qué tenés que hacer?"
          />
        </Field>

        <Field label="Notas">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Detalles, links, lo que necesites recordar…"
            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Día">
            <input type="date" value={day} onChange={(event) => setDay(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Hora">
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              disabled={!day}
              className={`${inputClass} disabled:opacity-40`}
            />
          </Field>
        </div>
        <p className="-mt-3 text-[11px] text-muted">
          {day && time
            ? "Con hora se agenda y se sincroniza con Google Calendar."
            : day
              ? "Sin hora queda como vencimiento del día, sin ir al calendario."
              : "Sin día queda en el Inbox."}
        </p>

        <Field label="Lista">
          <select value={listId} onChange={(event) => setListId(event.target.value)} className={inputClass}>
            <option value="">Inbox</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>{list.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Prioridad">
          <div className="flex overflow-hidden rounded-xl border border-border">
            {PRIORITIES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriority(option.value)}
                className={`min-h-11 flex-1 text-xs font-semibold transition-colors ${
                  priority === option.value ? "bg-primary text-white" : `bg-surface ${option.tone} hover:bg-surface-2`
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Matriz de prioridades">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUrgent(!urgent)}
              aria-pressed={urgent}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors ${
                urgent ? "border-danger bg-danger/10 text-danger" : "border-border text-muted hover:bg-surface-2"
              }`}
            >
              <AlertTriangle size={15} /> Urgente
            </button>
            <button
              type="button"
              onClick={() => setImportant(!important)}
              aria-pressed={important}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors ${
                important ? "border-success bg-success/10 text-success" : "border-border text-muted hover:bg-surface-2"
              }`}
            >
              <Star size={15} /> Importante
            </button>
          </div>
          <p className="text-[11px] text-muted">Definen en qué cuadrante aparece en la vista Prioridades.</p>
        </Field>

        <Field label="Recordatorio">
          <select
            value={reminder}
            onChange={(event) => setReminder(event.target.value)}
            disabled={!day || !time}
            className={`${inputClass} disabled:opacity-40`}
          >
            {REMINDERS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        {(!day || !time) && (
          <p className="-mt-3 text-[11px] text-muted">Poné día y hora para poder avisarte.</p>
        )}

        {task.syncStatus === "ERROR" && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-3">
            <p className="text-xs font-medium text-danger">No se pudo sincronizar con Google</p>
            {task.syncError && <p className="mt-1 text-[11px] text-muted">{task.syncError}</p>}
            <button
              type="button"
              onClick={onRetrySync}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <RefreshCw size={12} /> Reintentar
            </button>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3 sm:px-6">
        <Button type="button" variant="ghost" className="px-3 text-danger" onClick={() => setConfirming(true)}>
          <Trash2 size={16} />
          <span className="sr-only sm:not-sr-only">Borrar</span>
        </Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={pending || !title.trim()}>Guardar</Button>
        </div>
      </footer>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="¿Borrar esta tarea?"
        description={
          task.syncStatus === "SYNCED"
            ? "Se borra también el evento en Google Calendar. No se puede deshacer."
            : "No se puede deshacer."
        }
        confirmLabel="Borrar"
        isPending={pending}
        onConfirm={() => start(() => { onDelete(); setConfirming(false); })}
      />
    </>
  );
}

export function TaskDetailPanel({
  task,
  lists,
  onClose,
  onSave,
  onDelete,
  onRetrySync,
}: {
  task: OrganizationTask | null;
  lists: TaskList[];
  onClose: () => void;
  onSave: (id: string, patch: TaskPatch) => void;
  onDelete: (id: string) => void;
  onRetrySync: (id: string) => void;
}) {
  return (
    <RadixDialog.Root open={!!task} onOpenChange={(open) => { if (!open) onClose(); }}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <RadixDialog.Content
          data-keyboard-aware-modal
          aria-describedby={undefined}
          className={
            "fixed z-[70] flex flex-col border-border bg-surface shadow-[0_24px_64px_oklch(0_0_0/60%)] " +
            // Celular: hoja que sube desde abajo. Escritorio: panel a la derecha.
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t " +
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-none sm:border-l sm:border-t-0 " +
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out " +
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom " +
            "sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right"
          }
        >
          <header className="flex shrink-0 items-start justify-between gap-3 px-4 py-4 sm:px-6">
            <RadixDialog.Title className="text-base font-semibold tracking-tight text-foreground">
              Detalle de la tarea
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button
                aria-label="Cerrar"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X size={18} />
              </button>
            </RadixDialog.Close>
          </header>
          {/* La key reinicia el formulario al cambiar de tarea, sin efectos. */}
          {task && (
            <TaskForm
              key={task.id}
              task={task}
              lists={lists}
              onSave={(patch) => onSave(task.id, patch)}
              onDelete={() => onDelete(task.id)}
              onRetrySync={() => onRetrySync(task.id)}
              onClose={onClose}
            />
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
