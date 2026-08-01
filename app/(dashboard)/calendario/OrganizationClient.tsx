"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Columns3,
  Flame, Pencil, Plus, RefreshCw, Sparkles, Target, Trash2, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { OrganizationTask } from "@/lib/db/organization";
import type { AgendaEvent } from "@/lib/db/agenda";
import {
  createHabitAction, createOrganizationListAction, createOrganizationTaskAction,
  deleteHabitAction, deleteOrganizationListAction, deleteOrganizationTaskAction,
  retryTaskSyncAction, toggleHabitAction, updateHabitAction,
  updateOrganizationListAction, updateOrganizationTaskAction,
} from "@/app/actions/organization";
import { getHabitStreak, isHabitDue } from "@/lib/habit-streak";
import { TaskDetailPanel, type TaskPatch } from "./TaskDetailPanel";

type List = { id: string; name: string; color: string; isInbox: boolean };
type Habit = {
  id: string; name: string; icon: string | null; color: string; frequency: string;
  daysOfWeek: number[]; completions: { id: string; date: string }[];
};
/**
 * Tres vistas, una por trabajo real: arrancar el día, planificar la semana y
 * clasificar lo que entra. Antes eran siete pestañas, que dividían la atención
 * sin que ninguna terminara siendo buena. Listas dejó de ser vista y pasó a ser
 * un filtro que aplica a las tres; los hábitos viven adentro de Hoy.
 */
type View = "today" | "week" | "organize";
type WeekZoom = "week" | "month";
type OrganizeAxis = "kanban" | "eisenhower" | "lists" | "habits";

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };

/** Sin hora que mande, el orden lo define la prioridad y después la matriz. */
function byPriority(a: OrganizationTask, b: OrganizationTask): number {
  const priority = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
  if (priority !== 0) return priority;
  const weight = (task: OrganizationTask) => (task.urgent ? 2 : 0) + (task.important ? 1 : 0);
  const importance = weight(b) - weight(a);
  if (importance !== 0) return importance;
  return a.order - b.order;
}
const TZ = "America/Argentina/Buenos_Aires";
const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TZ });
const today = () => dayKey(new Date());
const VIEW_ITEMS: { key: View; label: string; hint: string; icon: typeof CalendarDays }[] = [
  { key: "today", label: "Hoy", hint: "Arrancar el día", icon: Sparkles },
  { key: "week", label: "Semana", hint: "Planificar", icon: CalendarDays },
  { key: "organize", label: "Organizar", hint: "Clasificar", icon: Columns3 },
];

/** Toggle segmentado para los sub-modos de Semana y Organizar. */
function Toggle<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-border">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-10 px-4 text-xs font-semibold transition-colors ${
            value === option.value ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Section({ icon, title, count, children }: {
  icon: React.ReactNode; title: string; count: number; children: React.ReactNode;
}) {
  if (!count) return null;
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        {icon} {title} <span className="text-muted/70">{count}</span>
      </h2>
      {children}
    </section>
  );
}

/**
 * Hábitos que tocan hoy, arriba del plan. Antes vivían en una pestaña aparte:
 * un hábito diario es parte del día, no una sección que hay que ir a buscar.
 */
function TodayHabits({ habits, day, onToggle }: {
  habits: Habit[]; day: string; onToggle: (habitId: string, day: string) => void;
}) {
  const due = habits.filter((habit) => isHabitDue(day, { frequency: habit.frequency, daysOfWeek: habit.daysOfWeek ?? [] }));
  if (!due.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {due.map((habit) => {
        const done = habit.completions.some((completion) => completion.date === day);
        const streak = getHabitStreak(
          { frequency: habit.frequency, daysOfWeek: habit.daysOfWeek ?? [] },
          habit.completions.map((completion) => completion.date),
          day,
        );
        return (
          <button
            key={habit.id}
            onClick={() => onToggle(habit.id, day)}
            aria-pressed={done}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm transition-colors ${
              done ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted hover:border-primary/40"
            }`}
          >
            <span className={`grid h-5 w-5 place-items-center rounded-full border ${done ? "border-primary bg-primary text-white" : "border-border"}`}>
              {done && <Check size={12} />}
            </span>
            <span>{habit.icon ?? "●"} {habit.name}</span>
            {streak.current > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-500">
                <Flame size={11} />{streak.current}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TodayView({ day, tasks, habits, finance, lists, update, onOpen, onToggleHabit }: {
  day: string;
  tasks: OrganizationTask[];
  habits: Habit[];
  finance: AgendaEvent[];
  lists: List[];
  update: (id: string, patch: TaskPatch) => void;
  onOpen: (id: string) => void;
  onToggleHabit: (habitId: string, day: string) => void;
}) {
  // Primero lo que tiene hora, que es lo que tiene una restricción real; después
  // lo que sólo vence hoy, ordenado por prioridad.
  const timed = tasks
    .filter((task) => task.scheduledStart && dayKey(new Date(task.scheduledStart)) === day)
    .sort((a, b) => Date.parse(a.scheduledStart!) - Date.parse(b.scheduledStart!));
  const untimed = tasks
    .filter((task) => !task.scheduledStart && task.dueDate && dayKey(new Date(task.dueDate)) === day)
    .sort(byPriority);
  const total = timed.length + untimed.length + finance.length;

  return (
    <div className="space-y-6">
      <TodayHabits habits={habits} day={day} onToggle={onToggleHabit} />

      {total === 0 ? (
        <Empty text="No hay nada para este día. Disfrutalo o planificá algo." />
      ) : (
        <>
          <Section icon={<Clock3 size={13} />} title="Con hora" count={timed.length}>
            {timed.map((task) => (
              <TaskRow key={task.id} task={task} lists={lists} onChange={update} onOpen={onOpen} />
            ))}
          </Section>

          <Section icon={<Wallet size={13} />} title="Vence hoy" count={finance.length}>
            {finance.map((event) => <FinanceRow key={event.id} event={event} />)}
          </Section>

          <Section icon={<Target size={13} />} title="Sin hora" count={untimed.length}>
            {untimed.map((task) => (
              <TaskRow key={task.id} task={task} lists={lists} onChange={update} onOpen={onOpen} />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

/** Mueve una tarea a otro día conservando la hora si la tenía. */
function patchForDay(task: OrganizationTask, day: string): TaskPatch {
  const dueDate = new Date(`${day}T12:00:00-03:00`).toISOString();
  if (!task.scheduledStart) return { dueDate, scheduledStart: null, scheduledEnd: null };
  const time = new Date(task.scheduledStart).toLocaleTimeString("es-AR", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const scheduledStart = new Date(`${day}T${time}:00-03:00`).toISOString();
  return {
    dueDate,
    scheduledStart,
    scheduledEnd: new Date(Date.parse(scheduledStart) + 3_600_000).toISOString(),
  };
}

function WeekView({ week, tasks, undated, financeOn, lists, update, onOpen }: {
  week: Date[];
  tasks: OrganizationTask[];
  undated: OrganizationTask[];
  financeOn: (day: string) => AgendaEvent[];
  lists: List[];
  update: (id: string, patch: TaskPatch) => void;
  onOpen: (id: string) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  const byId = new Map(tasks.concat(undated).map((task) => [task.id, task]));
  const drop = (day: string) => (event: React.DragEvent) => {
    event.preventDefault();
    setOver(null);
    const task = byId.get(event.dataTransfer.getData("task"));
    if (task) update(task.id, patchForDay(task, day));
  };
  const tasksOn = (day: string) => tasks
    .filter((task) => {
      const source = task.scheduledStart ?? task.dueDate;
      return source ? dayKey(new Date(source)) === day : false;
    })
    .sort((a, b) => {
      if (a.scheduledStart && b.scheduledStart) return Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart);
      if (a.scheduledStart) return -1;
      if (b.scheduledStart) return 1;
      return byPriority(a, b);
    });

  const loads = week.map((date) => tasksOn(dayKey(date)).length);
  const busiest = Math.max(1, ...loads);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="grid gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-7 lg:min-w-[860px]">
        {week.map((date, index) => {
          const key = dayKey(date);
          const dayTasks = tasksOn(key);
          const money = financeOn(key);
          const scheduledHours = dayTasks.filter((task) => task.scheduledStart).length;
          const isToday = key === today();
          return (
            <section
              key={key}
              onDragOver={(event) => { event.preventDefault(); setOver(key); }}
              onDragLeave={() => setOver((current) => (current === key ? null : current))}
              onDrop={drop(key)}
              className={`min-h-56 rounded-2xl border p-3 transition-colors ${
                over === key ? "border-primary bg-primary/5" : "border-border bg-surface"
              }`}
            >
              <p className="text-xs uppercase text-muted">{date.toLocaleDateString("es-AR", { weekday: "short" })}</p>
              <p className={`mt-1 text-xl font-bold ${isToday ? "text-primary" : ""}`}>{date.getDate()}</p>

              {/* Carga del día: para ver de un vistazo cuál está cargado. */}
              <div className="mt-2 h-1 rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${loads[index] >= busiest && busiest > 1 ? "bg-danger" : "bg-primary"}`}
                  style={{ width: `${Math.round((loads[index] / busiest) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted">
                {dayTasks.length} tarea{dayTasks.length === 1 ? "" : "s"}
                {scheduledHours > 0 && ` · ${scheduledHours} con hora`}
                {money.length > 0 && ` · ${money.length} vence`}
              </p>

              <div className="mt-3 space-y-2">
                {dayTasks.map((task) => (
                  <div key={task.id} draggable onDragStart={(event) => event.dataTransfer.setData("task", task.id)}>
                    <TaskRow task={task} lists={lists} onChange={update} onOpen={onOpen} />
                  </div>
                ))}
                {money.map((event) => <FinanceRow key={event.id} event={event} />)}
              </div>
            </section>
          );
        })}
      </div>

      {/* Bandeja de lo que todavía no tiene día: se arrastra a cualquier columna. */}
      <aside className="rounded-2xl border border-border bg-surface p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Sin día</h2>
          <span className="text-xs text-muted">{undated.length}</span>
        </div>
        <div className="space-y-2">
          {undated.map((task) => (
            <div key={task.id} draggable onDragStart={(event) => event.dataTransfer.setData("task", task.id)}>
              <TaskRow task={task} lists={lists} onChange={update} onOpen={onOpen} />
            </div>
          ))}
          {!undated.length && <p className="py-6 text-center text-xs text-muted">Todo tiene día asignado.</p>}
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Arrastrá una tarea a un día para agendarla. Desde el celular, abrila y elegí el día.
        </p>
      </aside>
    </div>
  );
}

const PRIORITY_TONE: Record<string, string> = {
  LOW: "text-primary", MEDIUM: "text-amber-500", HIGH: "text-danger",
};

function TaskRow({ task, lists, onChange, onOpen }: {
  task: OrganizationTask; lists: List[];
  onChange: (id: string, patch: Partial<OrganizationTask>) => void;
  onOpen?: (id: string) => void;
}) {
  const time = task.scheduledStart
    ? new Date(task.scheduledStart).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
    : null;
  const list = task.listId ? lists.find((l) => l.id === task.listId) : null;
  return (
    <article className="group flex items-center gap-3 rounded-xl border border-border/70 bg-surface px-3 py-3 transition-colors hover:border-primary/35">
      <button
        aria-label={task.done ? "Reabrir tarea" : "Completar tarea"}
        onClick={() => onChange(task.id, { status: task.done ? "TODO" : "DONE" })}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${task.done ? "border-primary bg-primary text-white" : "border-border text-transparent hover:border-primary"}`}
      >
        <Check size={14} />
      </button>
      {/* Todo el cuerpo abre el detalle: es el único lugar donde se edita. */}
      <button
        type="button"
        onClick={() => onOpen?.(task.id)}
        disabled={!onOpen}
        className="min-w-0 flex-1 text-left disabled:cursor-default"
      >
        <p className={`truncate text-sm font-medium ${task.done ? "text-muted line-through" : "text-foreground"}`}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          {time && <span className="inline-flex items-center gap-1"><Clock3 size={11} />{time}</span>}
          {list && <span style={{ color: list.color }}>{list.name}</span>}
          {task.priority !== "NONE" && <span className={PRIORITY_TONE[task.priority] ?? ""}>Prioridad {task.priority.toLowerCase()}</span>}
          {task.urgent && <span className="text-danger">Urgente</span>}
          {task.important && <span className="text-success">Importante</span>}
          {task.syncStatus === "SYNCED" && <span className="text-success">Google ✓</span>}
          {task.syncStatus === "ERROR" && <span className="text-danger" title={task.syncError ?? ""}>Sin sincronizar</span>}
        </div>
      </button>
    </article>
  );
}

function AddTask({ lists, initialDay }: { lists: List[]; initialDay?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(initialDay ?? today());
  const [time, setTime] = useState("");
  const [listId, setListId] = useState("");
  const save = () => start(async () => {
    const scheduledStart = time ? new Date(`${day}T${time}:00-03:00`).toISOString() : null;
    const result = await createOrganizationTaskAction({
      title, dueDate: day ? new Date(`${day}T12:00:00-03:00`).toISOString() : null,
      scheduledStart,
      scheduledEnd: scheduledStart ? new Date(Date.parse(scheduledStart) + 60 * 60_000).toISOString() : null,
      listId: listId || null,
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success(time ? "Tarea agendada y sincronizada" : "Tarea creada");
    setTitle(""); setOpen(false); router.refresh();
  });
  if (!open) return (
    // Al abrir tomamos el día que se está mirando: si no, quedaba pegado al que
    // había cuando se montó el componente y creaba la tarea en el día equivocado.
    <button onClick={() => { setDay(initialDay ?? today()); setOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm">
      <Plus size={17} /> Nueva tarea
    </button>
  );
  return (
    <div className="flex w-full flex-wrap gap-2 rounded-2xl border border-primary/25 bg-primary/5 p-3">
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="¿Qué tenés que hacer?" className="min-h-11 min-w-52 flex-1 rounded-xl border border-border bg-background px-3 text-sm" />
      <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm" />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm" />
      <select value={listId} onChange={(e) => setListId(e.target.value)} className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm">
        <option value="">Inbox</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
      </select>
      <button disabled={pending || !title.trim()} onClick={save} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">Guardar</button>
      <button onClick={() => setOpen(false)} className="min-h-11 px-3 text-sm text-muted">Cancelar</button>
    </div>
  );
}

export function OrganizationClient({ initial, financeEvents, googleConnected }: {
  initial: { tasks: OrganizationTask[]; lists: List[]; habits: Habit[] };
  financeEvents: AgendaEvent[];
  googleConnected: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("today");
  const [anchor, setAnchor] = useState(new Date());
  const [tasks, setTasks] = useState(initial.tasks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<WeekZoom>("week");
  const [axis, setAxis] = useState<OrganizeAxis>("kanban");
  const [listFilter, setListFilter] = useState<string | null | "all">("all");
  const [pending, start] = useTransition();
  const currentDay = dayKey(anchor);
  const update = (id: string, patch: TaskPatch) => {
    const before = tasks;
    setTasks((items) => items.map((item) => item.id === id ? { ...item, ...patch, done: patch.status ? patch.status === "DONE" : item.done } : item));
    start(async () => {
      const result = await updateOrganizationTaskAction(
        id,
        patch as Parameters<typeof updateOrganizationTaskAction>[1],
      );
      if (result.error) { setTasks(before); toast.error(result.error); }
      else router.refresh();
    });
  };
  const saveDetail = (id: string, patch: TaskPatch) => {
    update(id, patch);
    setSelectedId(null);
    toast.success("Tarea actualizada");
  };
  const remove = (id: string) => {
    const before = tasks;
    setTasks((items) => items.filter((item) => item.id !== id));
    setSelectedId(null);
    start(async () => {
      const result = await deleteOrganizationTaskAction(id);
      if (result.error) { setTasks(before); toast.error(result.error); }
      else { toast.success("Tarea borrada"); router.refresh(); }
    });
  };
  const retrySync = (id: string) => start(async () => {
    const result = await retryTaskSyncAction(id);
    if (result.error) toast.error(result.error);
    else { toast.success("Sincronizada con Google"); router.refresh(); }
  });
  const selected = tasks.find((task) => task.id === selectedId) ?? null;
  const open = (id: string) => setSelectedId(id);
  const toggleHabit = (habitId: string, day: string) => start(async () => {
    const result = await toggleHabitAction(habitId, day);
    if (result.error) toast.error(result.error);
    else router.refresh();
  });

  // El filtro por lista aplica a las tres vistas: reemplaza a la pestaña Listas.
  const matchesFilter = (task: OrganizationTask) =>
    listFilter === "all" ? true : task.listId === listFilter;
  const visible = tasks.filter(matchesFilter);
  const visibleActive = visible.filter((task) => !task.done);
  const undated = visibleActive.filter((task) => !task.dueDate && !task.scheduledStart);
  const week = useMemo(() => {
    const d = new Date(anchor); const wd = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - wd);
    return Array.from({ length: 7 }, (_, index) => { const x = new Date(d); x.setDate(d.getDate() + index); return x; });
  }, [anchor]);
  const financeOn = (key: string) => financeEvents.filter((event) => dayKey(new Date(event.date)) === key);
  const step = view === "today" ? 1 : zoom === "week" ? 7 : 30;

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organización</h1>
          <p className="mt-1 text-sm text-muted">Tareas, agenda, prioridades y hábitos en un solo lugar.</p>
        </div>
        <div className="flex items-center gap-2">
          {googleConnected ? (
            <span className="hidden rounded-full bg-success/10 px-3 py-1.5 text-xs text-success sm:inline-flex">
              Google Calendar conectado
            </span>
          ) : (
            // Antes era un span: decía "conectá" y no se podía hacer nada.
            <a
              href="/api/google/connect"
              className="hidden rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/20 sm:inline-flex"
            >
              Conectá Google Calendar →
            </a>
          )}
          <AddTask lists={initial.lists} initialDay={currentDay} />
        </div>
      </header>

      <nav className="flex gap-1 rounded-2xl border border-border bg-surface p-1.5">
        {VIEW_ITEMS.map((item) => (
          <button
            key={item.key} onClick={() => setView(item.key)}
            className={`inline-flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-sm font-medium transition-colors sm:flex-row sm:gap-2 ${
              view === item.key ? "bg-primary text-white" : "text-muted hover:bg-surface-2"
            }`}
          >
            <item.icon size={15} />
            {item.label}
            <span className={`hidden text-[11px] font-normal lg:inline ${view === item.key ? "text-white/70" : "text-muted/70"}`}>
              · {item.hint}
            </span>
          </button>
        ))}
      </nav>

      {/* Filtro por lista: reemplaza a la pestaña Listas y aplica a las 3 vistas. */}
      {initial.lists.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setListFilter("all")}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium ${listFilter === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:bg-surface-2"}`}
          >
            Todas
          </button>
          <button
            onClick={() => setListFilter(null)}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium ${listFilter === null ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:bg-surface-2"}`}
          >
            Inbox
          </button>
          {initial.lists.map((list) => (
            <button
              key={list.id} onClick={() => setListFilter(list.id)}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${listFilter === list.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:bg-surface-2"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: list.color }} />
              {list.name}
            </button>
          ))}
        </div>
      )}

      {view !== "organize" && (
        <div className="flex items-center justify-between">
          <button aria-label="Anterior" onClick={() => setAnchor(new Date(anchor.getTime() - step * 86_400_000))} className="grid h-11 w-11 place-items-center rounded-xl border border-border"><ChevronLeft size={18} /></button>
          <button onClick={() => setAnchor(new Date())} className="text-sm font-semibold capitalize">
            {view === "today"
              ? anchor.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
              : anchor.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
          </button>
          <button aria-label="Siguiente" onClick={() => setAnchor(new Date(anchor.getTime() + step * 86_400_000))} className="grid h-11 w-11 place-items-center rounded-xl border border-border"><ChevronRight size={18} /></button>
        </div>
      )}

      {view === "today" && (
        <TodayView
          day={currentDay}
          tasks={visibleActive}
          habits={initial.habits}
          finance={financeOn(currentDay)}
          lists={initial.lists}
          update={update}
          onOpen={open}
          onToggleHabit={toggleHabit}
        />
      )}

      {view === "week" && (
        <div className="space-y-4">
          <Toggle
            value={zoom}
            onChange={setZoom}
            options={[{ value: "week", label: "Semana" }, { value: "month", label: "Mes" }]}
          />
          {zoom === "week" ? (
            <WeekView
              week={week}
              tasks={visibleActive}
              undated={undated}
              financeOn={financeOn}
              lists={initial.lists}
              update={update}
              onOpen={open}
            />
          ) : (
            <MonthCalendar
              anchor={anchor}
              tasks={visibleActive}
              finance={financeEvents}
              onSelect={(date) => { setAnchor(date); setView("today"); }}
            />
          )}
        </div>
      )}

      {view === "organize" && (
        <div className="space-y-4">
          <Toggle
            value={axis}
            onChange={setAxis}
            options={[
              { value: "kanban", label: "Por estado" },
              { value: "eisenhower", label: "Por prioridad" },
              { value: "lists", label: "Listas" },
              { value: "habits", label: "Hábitos" },
            ]}
          />
          {axis === "kanban" && <Kanban tasks={visible} lists={initial.lists} update={update} onOpen={open} />}
          {axis === "eisenhower" && <Eisenhower tasks={visibleActive} lists={initial.lists} update={update} onOpen={open} />}
          {axis === "lists" && <ListsView lists={initial.lists} tasks={tasks.filter((task) => !task.done)} update={update} onOpen={open} />}
          {axis === "habits" && <Habits habits={initial.habits} />}
        </div>
      )}
      {pending && <div className="fixed bottom-24 right-5 rounded-full bg-foreground px-3 py-2 text-xs text-background shadow-lg"><RefreshCw size={12} className="mr-1 inline animate-spin" />Guardando</div>}

      <TaskDetailPanel
        task={selected}
        lists={initial.lists}
        onClose={() => setSelectedId(null)}
        onSave={saveDetail}
        onDelete={remove}
        onRetrySync={retrySync}
      />
    </main>
  );
}

function Panel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-surface p-4"><div className="mb-3 flex justify-between"><h2 className="font-semibold">{title}</h2><span className="text-xs text-muted">{count}</span></div><div className="space-y-2">{children || <p className="text-sm text-muted">Nada pendiente.</p>}</div></section>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-border bg-surface/40 text-sm text-muted">{text}</div>; }
function FinanceRow({ event }: { event: AgendaEvent }) { return <div className="rounded-xl border border-border/70 bg-surface-2/40 p-3"><div className="flex justify-between gap-2"><p className="truncate text-sm font-medium">{event.title}</p><span className={event.cashFlow === "income" ? "text-success" : "text-danger"}>{event.currency} {event.amount.toLocaleString("es-AR")}</span></div><p className="mt-1 text-[11px] text-muted">{event.subtitle}</p></div>; }

const LIST_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#a855f7", "#0ea5e9", "#64748b"];

function ListsView({ lists, tasks, update, onOpen }: {
  lists: List[]; tasks: OrganizationTask[];
  update: (id: string, patch: TaskPatch) => void;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string | null | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deleting, setDeleting] = useState<List | null>(null);
  const [pending, start] = useTransition();

  const inbox = { id: null as string | null, name: "Inbox", color: "#64748b" };
  const groups = [inbox, ...lists];
  const countOf = (id: string | null) => tasks.filter((task) => task.listId === id).length;
  const visible = selected === "all" ? groups : groups.filter((group) => group.id === selected);

  const create = () => start(async () => {
    const result = await createOrganizationListAction({ name });
    if (result.error) toast.error(result.error);
    else { setName(""); toast.success("Lista creada"); router.refresh(); }
  });
  const rename = (id: string) => start(async () => {
    const result = await updateOrganizationListAction(id, { name: draftName });
    if (result.error) toast.error(result.error);
    else { setEditing(null); router.refresh(); }
  });
  const recolor = (id: string, color: string) => start(async () => {
    const result = await updateOrganizationListAction(id, { color });
    if (result.error) toast.error(result.error);
    else router.refresh();
  });
  const remove = (list: List) => start(async () => {
    const result = await deleteOrganizationListAction(list.id);
    if (result.error) toast.error(result.error);
    else {
      setDeleting(null);
      if (selected === list.id) setSelected("all");
      toast.success(result.movedToInbox ? `Lista borrada · ${result.movedToInbox} tarea(s) al Inbox` : "Lista borrada");
      router.refresh();
    }
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-1 rounded-2xl border border-border bg-surface p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Mis listas</p>
        <button
          onClick={() => setSelected("all")}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm ${selected === "all" ? "bg-primary/10 text-primary" : "hover:bg-surface-2"}`}
        >
          Todas <span className="ml-auto text-xs text-muted">{tasks.length}</span>
        </button>
        {groups.map((group) => (
          <div key={group.id ?? "inbox"} className={`group/row rounded-xl ${selected === group.id ? "bg-primary/10" : "hover:bg-surface-2"}`}>
            {editing === group.id && group.id ? (
              <div className="flex items-center gap-1 p-1">
                <input
                  autoFocus value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") rename(group.id!); if (event.key === "Escape") setEditing(null); }}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
                <button onClick={() => rename(group.id!)} disabled={pending} className="rounded-lg px-2 py-1 text-xs font-semibold text-primary">OK</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2">
                <button onClick={() => setSelected(group.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: group.color }} />
                  <span className="truncate">{group.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted">{countOf(group.id)}</span>
                </button>
                {group.id && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      aria-label={`Renombrar ${group.name}`} title="Renombrar"
                      onClick={() => { setEditing(group.id); setDraftName(group.name); }}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-foreground"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      aria-label={`Borrar ${group.name}`} title="Borrar"
                      onClick={() => setDeleting(group as List)}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}
            {editing === group.id && group.id && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                {LIST_COLORS.map((color) => (
                  <button
                    key={color} aria-label={`Color ${color}`}
                    onClick={() => recolor(group.id!, color)}
                    className={`h-5 w-5 rounded-full border-2 ${group.color === color ? "border-foreground" : "border-transparent"}`}
                    style={{ background: color }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="mt-3 flex gap-2">
          <input
            value={name} onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) create(); }}
            placeholder="Nueva lista"
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
          />
          <button
            onClick={create} disabled={pending || !name.trim()}
            aria-label="Crear lista"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-white disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>
      </aside>

      <section className="space-y-5">
        {visible.map((group) => (
          <Panel key={group.id ?? "inbox"} title={group.name} count={countOf(group.id)}>
            {tasks.filter((task) => task.listId === group.id).map((task) => (
              <TaskRow key={task.id} task={task} lists={lists} onChange={update} onOpen={onOpen} />
            ))}
          </Panel>
        ))}
      </section>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={`¿Borrar la lista "${deleting?.name}"?`}
        description="Las tareas que tenga no se borran: pasan al Inbox."
        confirmLabel="Borrar lista"
        isPending={pending}
        onConfirm={() => deleting && remove(deleting)}
      />
    </div>
  );
}

const KANBAN_COLUMNS = [
  { status: "TODO", label: "Por hacer" },
  { status: "IN_PROGRESS", label: "En curso" },
  { status: "DONE", label: "Hecho" },
] as const;

function Kanban({ tasks, lists, update, onOpen }: {
  tasks: OrganizationTask[]; lists: List[];
  update: (id: string, patch: TaskPatch) => void;
  onOpen: (id: string) => void;
}) {
  const statusOf = (task: OrganizationTask) => task.status || (task.done ? "DONE" : "TODO");
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {KANBAN_COLUMNS.map(({ status, label }, columnIndex) => {
        const columnTasks = tasks.filter((task) => statusOf(task) === status);
        return (
          <section
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => update(event.dataTransfer.getData("task"), { status })}
            className="min-h-[280px] rounded-2xl border border-border bg-surface-2/30 p-3 md:min-h-[480px]"
          >
            <div className="mb-3 flex justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide">{label}</h2>
              <span className="text-xs text-muted">{columnTasks.length}</span>
            </div>
            <div className="space-y-2">
              {columnTasks.map((task) => (
                <div key={task.id} draggable onDragStart={(event) => event.dataTransfer.setData("task", task.id)}>
                  <TaskRow task={task} lists={lists} onChange={update} onOpen={onOpen} />
                  {/* Arrastrar no existe con el dedo: estas flechas hacen que la
                      vista sea usable en celular, que es donde más se usa. */}
                  <div className="mt-1 flex justify-end gap-1">
                    {columnIndex > 0 && (
                      <button
                        aria-label={`Mover a ${KANBAN_COLUMNS[columnIndex - 1].label}`}
                        title={`Mover a ${KANBAN_COLUMNS[columnIndex - 1].label}`}
                        onClick={() => update(task.id, { status: KANBAN_COLUMNS[columnIndex - 1].status })}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-foreground"
                      >
                        <ChevronLeft size={15} />
                      </button>
                    )}
                    {columnIndex < KANBAN_COLUMNS.length - 1 && (
                      <button
                        aria-label={`Mover a ${KANBAN_COLUMNS[columnIndex + 1].label}`}
                        title={`Mover a ${KANBAN_COLUMNS[columnIndex + 1].label}`}
                        onClick={() => update(task.id, { status: KANBAN_COLUMNS[columnIndex + 1].status })}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-foreground"
                      >
                        <ChevronRight size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!columnTasks.length && <p className="py-6 text-center text-xs text-muted">Sin tareas acá.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const QUADRANTS = [
  { urgent: true, important: true, name: "Hacer ahora", hint: "Urgente e importante", tone: "text-danger" },
  { urgent: false, important: true, name: "Programar", hint: "Importante, no urgente", tone: "text-success" },
  { urgent: true, important: false, name: "Delegar", hint: "Urgente, no importante", tone: "text-primary" },
  { urgent: false, important: false, name: "Evaluar", hint: "Ni urgente ni importante", tone: "text-muted" },
];

function Eisenhower({ tasks, lists, update, onOpen }: {
  tasks: OrganizationTask[]; lists: List[];
  update: (id: string, patch: TaskPatch) => void;
  onOpen: (id: string) => void;
}) {
  const unclassified = tasks.filter((task) => !task.urgent && !task.important);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Arrastrá una tarea a un cuadrante, o abrila para marcar urgente e importante.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {QUADRANTS.map((quadrant) => (
          <section
            key={quadrant.name}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => update(event.dataTransfer.getData("task"), { urgent: quadrant.urgent, important: quadrant.important })}
            className="min-h-64 rounded-2xl border border-border bg-surface p-4"
          >
            <div className="mb-3">
              <h2 className={`text-sm font-semibold uppercase ${quadrant.tone}`}>{quadrant.name}</h2>
              <p className="text-[11px] text-muted">{quadrant.hint}</p>
            </div>
            <div className="space-y-2">
              {tasks.filter((task) => task.urgent === quadrant.urgent && task.important === quadrant.important).map((task) => (
                <div key={task.id} draggable onDragStart={(event) => event.dataTransfer.setData("task", task.id)}>
                  <TaskRow task={task} lists={lists} onChange={update} onOpen={onOpen} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      {unclassified.length > 0 && (
        <p className="text-xs text-muted">
          {unclassified.length} tarea(s) siguen en &quot;Evaluar&quot; porque todavía no las clasificaste.
        </p>
      )}
    </div>
  );
}
function MonthCalendar({ anchor, tasks, finance, onSelect }: { anchor: Date; tasks: OrganizationTask[]; finance: AgendaEvent[]; onSelect: (d: Date) => void }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1); const offset = (first.getDay() + 6) % 7; const start = new Date(first); start.setDate(1 - offset);
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  return <div><div className="mb-2 grid grid-cols-7 text-center text-xs uppercase text-muted">{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d) => <span key={d}>{d}</span>)}</div><div className="grid grid-cols-7">{days.map((d) => { const key = dayKey(d); const count = tasks.filter((t) => { const x=t.scheduledStart??t.dueDate; return x && dayKey(new Date(x))===key; }).length; const money=finance.filter((e)=>dayKey(new Date(e.date))===key).length; return <button key={key} onClick={() => onSelect(d)} className={`min-h-24 border border-border/60 p-2 text-left align-top ${d.getMonth() !== anchor.getMonth() ? "opacity-35" : "bg-surface"}`}><span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${key === today() ? "bg-primary text-white" : ""}`}>{d.getDate()}</span>{count > 0 && <span className="mt-2 block truncate rounded bg-primary/12 px-1.5 py-1 text-[10px] text-primary">{count} tarea{count>1?"s":""}</span>}{money > 0 && <span className="mt-1 block truncate rounded bg-amber-500/12 px-1.5 py-1 text-[10px] text-amber-600">{money} vencimiento{money>1?"s":""}</span>}</button>; })}</div></div>;
}
const WEEKDAYS = [
  { value: 1, label: "L" }, { value: 2, label: "M" }, { value: 3, label: "M" },
  { value: 4, label: "J" }, { value: 5, label: "V" }, { value: 6, label: "S" }, { value: 0, label: "D" },
];

function HabitEditor({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(habit.name);
  const [icon, setIcon] = useState(habit.icon ?? "");
  const [frequency, setFrequency] = useState(habit.frequency);
  const [days, setDays] = useState<number[]>(habit.daysOfWeek ?? []);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const result = await updateHabitAction(habit.id, {
      name, icon: icon || null, frequency: frequency as "DAILY" | "WEEKLY",
      daysOfWeek: frequency === "WEEKLY" ? days : [],
    });
    if (result.error) toast.error(result.error);
    else { toast.success("Hábito actualizado"); onClose(); router.refresh(); }
  });

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
      <div className="flex gap-2">
        <input
          value={icon} onChange={(event) => setIcon(event.target.value)} maxLength={2}
          placeholder="🏃" aria-label="Ícono"
          className="min-h-11 w-14 rounded-xl border border-border bg-background text-center text-sm"
        />
        <input
          value={name} onChange={(event) => setName(event.target.value)}
          aria-label="Nombre del hábito"
          className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
        />
      </div>
      <div className="flex overflow-hidden rounded-xl border border-border">
        {(["DAILY", "WEEKLY"] as const).map((option) => (
          <button
            key={option} type="button" onClick={() => setFrequency(option)}
            className={`min-h-11 flex-1 text-xs font-semibold ${frequency === option ? "bg-primary text-white" : "bg-surface text-muted"}`}
          >
            {option === "DAILY" ? "Todos los días" : "Días elegidos"}
          </button>
        ))}
      </div>
      {frequency === "WEEKLY" && (
        <div className="flex gap-1.5">
          {WEEKDAYS.map((weekday) => (
            <button
              key={weekday.value} type="button"
              onClick={() => setDays((current) => current.includes(weekday.value) ? current.filter((d) => d !== weekday.value) : [...current, weekday.value])}
              aria-pressed={days.includes(weekday.value)}
              className={`h-10 flex-1 rounded-lg border text-xs font-semibold ${days.includes(weekday.value) ? "border-primary bg-primary text-white" : "border-border text-muted"}`}
            >
              {weekday.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="min-h-10 px-3 text-sm text-muted">Cancelar</button>
        <button onClick={save} disabled={pending || !name.trim()} className="min-h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40">Guardar</button>
      </div>
    </div>
  );
}

function Habits({ habits }: { habits: Habit[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Habit | null>(null);
  const [pending, start] = useTransition();
  const days = Array.from({ length: 28 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 27 + index);
    return dayKey(date);
  });
  const now = today();

  const create = () => start(async () => {
    const result = await createHabitAction({ name });
    if (result.error) toast.error(result.error);
    else { setName(""); toast.success("Hábito creado"); router.refresh(); }
  });
  const toggle = (habitId: string, day: string) => start(async () => {
    const result = await toggleHabitAction(habitId, day);
    if (result.error) toast.error(result.error);
    else router.refresh();
  });
  const destroy = (habit: Habit) => start(async () => {
    const result = await deleteHabitAction(habit.id);
    if (result.error) toast.error(result.error);
    else { setRemoving(null); toast.success("Hábito borrado"); router.refresh(); }
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={name} onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) create(); }}
          placeholder="Nuevo hábito, ej. Tomar vitaminas"
          className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <button onClick={create} disabled={pending || !name.trim()} className="min-h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40">
          <Plus size={16} className="mr-1 inline" />Añadir
        </button>
      </div>

      {habits.map((habit) => {
        const streak = getHabitStreak(
          { frequency: habit.frequency, daysOfWeek: habit.daysOfWeek ?? [] },
          habit.completions.map((completion) => completion.date),
          now,
        );
        return (
          <section key={habit.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{habit.icon ?? "●"} {habit.name}</p>
                <p className="text-[11px] text-muted">
                  {habit.frequency === "DAILY"
                    ? "Todos los días"
                    : habit.daysOfWeek?.length
                      ? habit.daysOfWeek.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join(" · ")
                      : "Todos los días"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-lg font-bold leading-none text-foreground">
                    <Flame size={15} className="mr-1 inline text-amber-500" />{streak.current}
                  </p>
                  <p className="text-[10px] text-muted">racha · mejor {streak.best} · {streak.rate}%</p>
                </div>
                <button
                  aria-label="Editar hábito" title="Editar"
                  onClick={() => setEditing(editing === habit.id ? null : habit.id)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
                >
                  <Pencil size={14} />
                </button>
                <button
                  aria-label="Borrar hábito" title="Borrar"
                  onClick={() => setRemoving(habit)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <div className="flex min-w-[560px] gap-1">
                {days.map((day) => {
                  const done = habit.completions.some((completion) => completion.date === day);
                  const due = isHabitDue(day, { frequency: habit.frequency, daysOfWeek: habit.daysOfWeek ?? [] });
                  return (
                    <button
                      key={day} title={due ? day : `${day} · no toca`}
                      aria-label={`${day}${done ? " cumplido" : ""}`}
                      onClick={() => toggle(habit.id, day)}
                      className={`h-6 flex-1 rounded-md border transition-colors ${
                        done ? "border-primary bg-primary" : due ? "border-border bg-surface-2 hover:border-primary" : "border-transparent bg-surface-2/30"
                      }`}
                    >
                      {done && <Check size={12} className="m-auto text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {editing === habit.id && <HabitEditor habit={habit} onClose={() => setEditing(null)} />}
          </section>
        );
      })}

      {!habits.length && <Empty text="Creá tu primer hábito para empezar a medir constancia." />}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title={`¿Borrar el hábito "${removing?.name}"?`}
        description="Se borra también todo el historial de días cumplidos. No se puede deshacer."
        confirmLabel="Borrar"
        isPending={pending}
        onConfirm={() => removing && destroy(removing)}
      />
    </div>
  );
}
