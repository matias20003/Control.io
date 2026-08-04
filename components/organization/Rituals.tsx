"use client";

/**
 * Los dos rituales: cerrar el día y planificar la semana.
 *
 * Los dos son el mismo mecanismo — una cola de tareas que se resuelven de a una
 * con decisiones explícitas — así que comparten componente. Esa obligación de
 * decidir es lo que garantiza que nada quede huérfano: sin ella, lo no hecho se
 * acumula invisible y el sistema deja de ser confiable.
 *
 * Nunca bloquean: se abren cuando querés y se cierran cuando querés.
 */
import { useState } from "react";
import { CalendarDays, Check, Moon, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { OrganizationTask } from "@/lib/db/organization";
import type { TaskPatch } from "./TaskDetailPanel";

const ARG_OFFSET = "-03:00";
const TZ = "America/Argentina/Buenos_Aires";

const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TZ });
const shiftDay = (day: string, days: number) =>
  dayKey(new Date(Date.parse(`${day}T12:00:00${ARG_OFFSET}`) + days * 86_400_000));

/** Reserva la tarea para un día, conservando la hora si tenía bloque. */
function moveTo(task: OrganizationTask, day: string): TaskPatch {
  if (!task.scheduledStart || !task.scheduledEnd) {
    return { scheduledStart: new Date(`${day}T00:00:00${ARG_OFFSET}`).toISOString(), scheduledEnd: null, someday: false };
  }
  const time = new Date(task.scheduledStart).toLocaleTimeString("es-AR", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const start = new Date(`${day}T${time}:00${ARG_OFFSET}`).toISOString();
  return { scheduledStart: start, scheduledEnd: new Date(Date.parse(start) + 3_600_000).toISOString(), someday: false };
}

const choiceClass =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border " +
  "px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5";

function Queue({
  title,
  intro,
  tasks,
  emptyText,
  doneText,
  open,
  onClose,
  renderChoices,
}: {
  title: string;
  intro: string;
  tasks: OrganizationTask[];
  emptyText: string;
  doneText: string;
  open: boolean;
  onClose: () => void;
  renderChoices: (task: OrganizationTask, next: () => void) => React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const task = tasks[index];
  const finished = index >= tasks.length;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) { setIndex(0); onClose(); } }}>
      <DialogContent title={title}>
        {tasks.length === 0 ? (
          <div className="py-8 text-center">
            <Check size={28} className="mx-auto text-success" />
            <p className="mt-3 text-sm text-muted">{emptyText}</p>
          </div>
        ) : finished ? (
          <div className="py-8 text-center">
            <Check size={28} className="mx-auto text-success" />
            <p className="mt-3 text-sm font-medium text-foreground">{doneText}</p>
            <button
              onClick={() => { setIndex(0); onClose(); }}
              className="mt-4 min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white"
            >
              Listo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{intro}</span>
              <span className="tabular-nums">{index + 1} de {tasks.length}</span>
            </div>
            <div className="h-1 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(index / tasks.length) * 100}%` }} />
            </div>

            <p className="text-lg font-semibold leading-tight text-foreground">{task.title}</p>
            {task.description && <p className="text-sm text-muted">{task.description}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              {renderChoices(task, () => setIndex((current) => current + 1))}
            </div>

            <button
              onClick={() => setIndex((current) => current + 1)}
              className="w-full text-center text-xs text-muted hover:text-foreground"
            >
              Dejarla como está
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Cierre del día: cada pendiente exige una decisión antes de cerrar. */
export function DayShutdown({ open, onClose, tasks, day, update, remove }: {
  open: boolean;
  onClose: () => void;
  tasks: OrganizationTask[];
  day: string;
  update: (id: string, patch: TaskPatch) => void;
  remove: (id: string) => void;
}) {
  return (
    <Queue
      open={open}
      onClose={onClose}
      title="Cerrar el día"
      intro="¿Qué hacemos con esto?"
      emptyText="No quedó nada pendiente. Buen día."
      doneText="Día cerrado. No quedó nada suelto."
      tasks={tasks}
      renderChoices={(task, next) => (
        <>
          <button className={choiceClass} onClick={() => { update(task.id, { status: "DONE" }); next(); }}>
            <Check size={15} /> Ya está
          </button>
          <button className={choiceClass} onClick={() => { update(task.id, moveTo(task, shiftDay(day, 1))); next(); }}>
            <CalendarDays size={15} /> Mañana
          </button>
          <button className={choiceClass} onClick={() => { update(task.id, moveTo(task, shiftDay(day, 7))); next(); }}>
            <CalendarDays size={15} /> En una semana
          </button>
          <button className={choiceClass} onClick={() => { update(task.id, { someday: true, scheduledStart: null, scheduledEnd: null }); next(); }}>
            <Moon size={15} /> Algún día
          </button>
          <button
            className={`${choiceClass} text-danger hover:border-danger hover:bg-danger/5`}
            onClick={() => { remove(task.id); next(); }}
          >
            <Trash2 size={15} /> Ya no va
          </button>
        </>
      )}
    />
  );
}

/** Planificación semanal: vaciar el Inbox decidiendo cuándo hacés cada cosa. */
export function WeekPlanner({ open, onClose, tasks, week, update, remove }: {
  open: boolean;
  onClose: () => void;
  tasks: OrganizationTask[];
  week: Date[];
  update: (id: string, patch: TaskPatch) => void;
  remove: (id: string) => void;
}) {
  return (
    <Queue
      open={open}
      onClose={onClose}
      title="Planificar la semana"
      intro="¿Cuándo lo hacés?"
      emptyText="El Inbox está vacío. La semana ya está armada."
      doneText="Inbox vacío. Semana lista."
      tasks={tasks}
      renderChoices={(task, next) => (
        <>
          {week.map((date) => {
            const key = dayKey(date);
            return (
              <button
                key={key}
                className={`${choiceClass} min-w-[4.5rem] flex-none flex-col gap-0 px-2`}
                onClick={() => { update(task.id, moveTo(task, key)); next(); }}
              >
                <span className="text-[10px] uppercase text-muted">
                  {date.toLocaleDateString("es-AR", { weekday: "short" })}
                </span>
                <span className="text-base font-bold">{date.getDate()}</span>
              </button>
            );
          })}
          <button className={choiceClass} onClick={() => { update(task.id, { someday: true }); next(); }}>
            <Moon size={15} /> Algún día
          </button>
          <button
            className={`${choiceClass} text-danger hover:border-danger hover:bg-danger/5`}
            onClick={() => { remove(task.id); next(); }}
          >
            <Trash2 size={15} /> Ya no va
          </button>
        </>
      )}
    />
  );
}
