"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Columns3,
  Flame, LayoutList, Plus, RefreshCw, Sparkles, Target,
} from "lucide-react";
import { toast } from "sonner";
import type { OrganizationTask } from "@/lib/db/organization";
import type { AgendaEvent } from "@/lib/db/agenda";
import {
  createHabitAction, createOrganizationListAction, createOrganizationTaskAction,
  toggleHabitAction, updateOrganizationTaskAction,
} from "@/app/actions/organization";

type List = { id: string; name: string; color: string; isInbox: boolean };
type Habit = {
  id: string; name: string; icon: string | null; color: string; frequency: string;
  daysOfWeek: number[]; completions: { id: string; date: string }[];
};
type View = "today" | "week" | "lists" | "kanban" | "eisenhower" | "calendar" | "habits";
const TZ = "America/Argentina/Buenos_Aires";
const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TZ });
const today = () => dayKey(new Date());
const VIEW_ITEMS: { key: View; label: string; icon: typeof CalendarDays }[] = [
  { key: "today", label: "Hoy", icon: Sparkles },
  { key: "week", label: "Semana", icon: CalendarDays },
  { key: "lists", label: "Listas", icon: LayoutList },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "eisenhower", label: "Prioridades", icon: Target },
  { key: "calendar", label: "Calendario", icon: CalendarDays },
  { key: "habits", label: "Hábitos", icon: Flame },
];

function TaskRow({ task, lists, onChange }: { task: OrganizationTask; lists: List[]; onChange: (id: string, patch: Partial<OrganizationTask>) => void }) {
  const time = task.scheduledStart
    ? new Date(task.scheduledStart).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <article className="group flex items-center gap-3 rounded-xl border border-border/70 bg-surface px-3 py-3 hover:border-primary/35 transition-colors">
      <button
        aria-label={task.done ? "Reabrir tarea" : "Completar tarea"}
        onClick={() => onChange(task.id, { status: task.done ? "TODO" : "DONE" })}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${task.done ? "border-primary bg-primary text-white" : "border-border text-transparent"}`}
      >
        <Check size={14} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${task.done ? "text-muted line-through" : "text-foreground"}`}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          {time && <span className="inline-flex items-center gap-1"><Clock3 size={11} />{time}</span>}
          {task.listId && <span style={{ color: lists.find((l) => l.id === task.listId)?.color }}>{lists.find((l) => l.id === task.listId)?.name}</span>}
          {task.priority !== "NONE" && <span>Prioridad {task.priority.toLowerCase()}</span>}
          {task.syncStatus === "SYNCED" && <span className="text-success">Google ✓</span>}
          {task.syncStatus === "ERROR" && <span className="text-danger" title={task.syncError ?? ""}>Sin sincronizar</span>}
        </div>
      </div>
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
    <button onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm">
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
  const [pending, start] = useTransition();
  const currentDay = dayKey(anchor);
  const update = (id: string, patch: Partial<OrganizationTask>) => {
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
  const active = tasks.filter((task) => !task.done);
  const tasksOn = (key: string) => active.filter((task) => {
    const source = task.scheduledStart ?? task.dueDate;
    return source ? dayKey(new Date(source)) === key : false;
  });
  const undated = active.filter((task) => !task.dueDate && !task.scheduledStart);
  const week = useMemo(() => {
    const d = new Date(anchor); const wd = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - wd);
    return Array.from({ length: 7 }, (_, index) => { const x = new Date(d); x.setDate(d.getDate() + index); return x; });
  }, [anchor]);
  const financeOn = (key: string) => financeEvents.filter((event) => dayKey(new Date(event.date)) === key);

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organización</h1>
          <p className="mt-1 text-sm text-muted">Tareas, agenda, prioridades y hábitos en un solo lugar.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`hidden rounded-full px-3 py-1.5 text-xs sm:inline-flex ${googleConnected ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-600"}`}>
            {googleConnected ? "Google Calendar conectado" : "Conectá Google Calendar"}
          </span>
          <AddTask lists={initial.lists} initialDay={currentDay} />
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1.5 scrollbar-none">
        {VIEW_ITEMS.map((item) => <button key={item.key} onClick={() => setView(item.key)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium ${view === item.key ? "bg-primary text-white" : "text-muted hover:bg-surface-2"}`}><item.icon size={15} />{item.label}</button>)}
      </nav>

      {(view === "today" || view === "week" || view === "calendar") && (
        <div className="flex items-center justify-between">
          <button onClick={() => setAnchor(new Date(anchor.getTime() - (view === "week" ? 7 : view === "calendar" ? 30 : 1) * 86_400_000))} className="grid h-11 w-11 place-items-center rounded-xl border border-border"><ChevronLeft size={18} /></button>
          <button onClick={() => setAnchor(new Date())} className="text-sm font-semibold capitalize">{anchor.toLocaleDateString("es-AR", { month: "long", year: "numeric", day: view === "today" ? "numeric" : undefined })}</button>
          <button onClick={() => setAnchor(new Date(anchor.getTime() + (view === "week" ? 7 : view === "calendar" ? 30 : 1) * 86_400_000))} className="grid h-11 w-11 place-items-center rounded-xl border border-border"><ChevronRight size={18} /></button>
        </div>
      )}

      {view === "today" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Plan de hoy · {tasksOn(currentDay).length} tareas</h2>
            {tasksOn(currentDay).map((task) => <TaskRow key={task.id} task={task} lists={initial.lists} onChange={update} />)}
            {!tasksOn(currentDay).length && <Empty text="No hay tareas para este día." />}
          </section>
          <aside className="space-y-4">
            <Panel title="Inbox" count={undated.length}>{undated.slice(0, 6).map((task) => <TaskRow key={task.id} task={task} lists={initial.lists} onChange={update} />)}</Panel>
            <Panel title="Finanzas próximas" count={financeOn(currentDay).length}>{financeOn(currentDay).map((event) => <FinanceRow key={event.id} event={event} />)}</Panel>
          </aside>
        </div>
      )}

      {view === "week" && <div className="grid min-w-[760px] grid-cols-7 gap-3 overflow-x-auto">{week.map((date) => <section key={dayKey(date)} className="min-h-80 rounded-2xl border border-border bg-surface p-3"><p className="text-xs uppercase text-muted">{date.toLocaleDateString("es-AR", { weekday: "short" })}</p><p className={`mb-3 mt-1 text-xl font-bold ${dayKey(date) === today() ? "text-primary" : ""}`}>{date.getDate()}</p><div className="space-y-2">{tasksOn(dayKey(date)).map((task) => <TaskRow key={task.id} task={task} lists={initial.lists} onChange={update} />)}{financeOn(dayKey(date)).map((event) => <FinanceRow key={event.id} event={event} />)}</div></section>)}</div>}

      {view === "lists" && <ListsView lists={initial.lists} tasks={active} update={update} />}
      {view === "kanban" && <Kanban tasks={tasks} lists={initial.lists} update={update} />}
      {view === "eisenhower" && <Eisenhower tasks={active} lists={initial.lists} update={update} />}
      {view === "calendar" && <MonthCalendar anchor={anchor} tasks={active} finance={financeEvents} onSelect={(date) => { setAnchor(date); setView("today"); }} />}
      {view === "habits" && <Habits habits={initial.habits} />}
      {pending && <div className="fixed bottom-24 right-5 rounded-full bg-foreground px-3 py-2 text-xs text-background shadow-lg"><RefreshCw size={12} className="mr-1 inline animate-spin" />Guardando</div>}
    </main>
  );
}

function Panel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-surface p-4"><div className="mb-3 flex justify-between"><h2 className="font-semibold">{title}</h2><span className="text-xs text-muted">{count}</span></div><div className="space-y-2">{children || <p className="text-sm text-muted">Nada pendiente.</p>}</div></section>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-border bg-surface/40 text-sm text-muted">{text}</div>; }
function FinanceRow({ event }: { event: AgendaEvent }) { return <div className="rounded-xl border border-border/70 bg-surface-2/40 p-3"><div className="flex justify-between gap-2"><p className="truncate text-sm font-medium">{event.title}</p><span className={event.cashFlow === "income" ? "text-success" : "text-danger"}>{event.currency} {event.amount.toLocaleString("es-AR")}</span></div><p className="mt-1 text-[11px] text-muted">{event.subtitle}</p></div>; }

function ListsView({ lists, tasks, update }: { lists: List[]; tasks: OrganizationTask[]; update: (id: string, patch: Partial<OrganizationTask>) => void }) {
  const router = useRouter(); const [name, setName] = useState("");
  const groups = [{ id: null, name: "Inbox", color: "#64748b", isInbox: true }, ...lists];
  return <div className="grid gap-4 lg:grid-cols-[240px_1fr]"><aside className="rounded-2xl border border-border bg-surface p-3"><p className="mb-3 text-xs font-semibold uppercase text-muted">Mis listas</p>{groups.map((list) => <div key={list.id ?? "inbox"} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ background: list.color }} />{list.name}<span className="ml-auto text-muted">{tasks.filter((t) => t.listId === list.id).length}</span></div>)}<div className="mt-3 flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva lista" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-sm" /><button onClick={async () => { const r = await createOrganizationListAction({ name }); if (r.error) toast.error(r.error); else { setName(""); router.refresh(); } }} className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white"><Plus size={16} /></button></div></aside><section className="space-y-5">{groups.map((list) => <Panel key={list.id ?? "inbox"} title={list.name} count={tasks.filter((t) => t.listId === list.id).length}>{tasks.filter((t) => t.listId === list.id).map((task) => <TaskRow key={task.id} task={task} lists={lists} onChange={update} />)}</Panel>)}</section></div>;
}
function Kanban({ tasks, lists, update }: { tasks: OrganizationTask[]; lists: List[]; update: (id: string, patch: Partial<OrganizationTask>) => void }) {
  const columns = [["TODO", "Por hacer"], ["IN_PROGRESS", "En curso"], ["DONE", "Hecho"]] as const;
  return <div className="grid min-w-[780px] grid-cols-3 gap-4 overflow-x-auto">{columns.map(([status, label]) => <section key={status} onDragOver={(e) => e.preventDefault()} onDrop={(e) => update(e.dataTransfer.getData("task"), { status })} className="min-h-[480px] rounded-2xl border border-border bg-surface-2/30 p-3"><div className="mb-3 flex justify-between"><h2 className="text-sm font-semibold uppercase tracking-wide">{label}</h2><span className="text-xs text-muted">{tasks.filter((t) => (t.status || (t.done ? "DONE" : "TODO")) === status).length}</span></div><div className="space-y-2">{tasks.filter((t) => (t.status || (t.done ? "DONE" : "TODO")) === status).map((task) => <div key={task.id} draggable onDragStart={(e) => e.dataTransfer.setData("task", task.id)}><TaskRow task={task} lists={lists} onChange={update} /></div>)}</div></section>)}</div>;
}
function Eisenhower({ tasks, lists, update }: { tasks: OrganizationTask[]; lists: List[]; update: (id: string, patch: Partial<OrganizationTask>) => void }) {
  const quadrants = [{ u: true, i: true, name: "Hacer ahora", tone: "text-danger" }, { u: false, i: true, name: "Programar", tone: "text-success" }, { u: true, i: false, name: "Delegar", tone: "text-primary" }, { u: false, i: false, name: "Evaluar", tone: "text-muted" }];
  return <div className="grid gap-4 md:grid-cols-2">{quadrants.map((q) => <section key={q.name} className="min-h-64 rounded-2xl border border-border bg-surface p-4"><h2 className={`mb-3 text-sm font-semibold uppercase ${q.tone}`}>{q.name}</h2><div className="space-y-2">{tasks.filter((t) => t.urgent === q.u && t.important === q.i).map((task) => <TaskRow key={task.id} task={task} lists={lists} onChange={update} />)}</div></section>)}</div>;
}
function MonthCalendar({ anchor, tasks, finance, onSelect }: { anchor: Date; tasks: OrganizationTask[]; finance: AgendaEvent[]; onSelect: (d: Date) => void }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1); const offset = (first.getDay() + 6) % 7; const start = new Date(first); start.setDate(1 - offset);
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  return <div><div className="mb-2 grid grid-cols-7 text-center text-xs uppercase text-muted">{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d) => <span key={d}>{d}</span>)}</div><div className="grid grid-cols-7">{days.map((d) => { const key = dayKey(d); const count = tasks.filter((t) => { const x=t.scheduledStart??t.dueDate; return x && dayKey(new Date(x))===key; }).length; const money=finance.filter((e)=>dayKey(new Date(e.date))===key).length; return <button key={key} onClick={() => onSelect(d)} className={`min-h-24 border border-border/60 p-2 text-left align-top ${d.getMonth() !== anchor.getMonth() ? "opacity-35" : "bg-surface"}`}><span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${key === today() ? "bg-primary text-white" : ""}`}>{d.getDate()}</span>{count > 0 && <span className="mt-2 block truncate rounded bg-primary/12 px-1.5 py-1 text-[10px] text-primary">{count} tarea{count>1?"s":""}</span>}{money > 0 && <span className="mt-1 block truncate rounded bg-amber-500/12 px-1.5 py-1 text-[10px] text-amber-600">{money} vencimiento{money>1?"s":""}</span>}</button>; })}</div></div>;
}
function Habits({ habits }: { habits: Habit[] }) {
  const router=useRouter(); const [name,setName]=useState(""); const days=Array.from({length:28},(_,i)=>{const d=new Date();d.setDate(d.getDate()-27+i);return dayKey(d);});
  return <div className="space-y-4"><div className="flex gap-2"><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nuevo hábito, ej. Tomar vitaminas" className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm"/><button onClick={async()=>{const r=await createHabitAction({name});if(r.error)toast.error(r.error);else{setName("");router.refresh();}}} className="rounded-xl bg-primary px-4 text-sm font-semibold text-white"><Plus size={16} className="mr-1 inline"/>Añadir hábito</button></div><section className="overflow-x-auto rounded-2xl border border-border bg-surface p-4"><div className="min-w-[820px] space-y-4">{habits.map((habit)=><div key={habit.id} className="grid grid-cols-[180px_1fr_50px] items-center gap-3"><div><p className="truncate text-sm font-medium">{habit.icon ?? "●"} {habit.name}</p><p className="text-[11px] text-muted">{habit.frequency === "DAILY" ? "Todos los días" : habit.frequency}</p></div><div className="grid grid-cols-[repeat(28,minmax(0,1fr))] gap-1">{days.map((day)=>{const done=habit.completions.some((c)=>c.date===day);return <button title={day} key={day} onClick={async()=>{await toggleHabitAction(habit.id,day);router.refresh();}} className={`h-5 w-5 rounded-md border ${done?"border-primary bg-primary":"border-border bg-surface-2"}`}>{done&&<Check size={12} className="m-auto text-white"/>}</button>})}</div><span className="text-right text-xs text-muted">{habit.completions.length}</span></div>)}{!habits.length&&<Empty text="Creá tu primer hábito para empezar a medir constancia."/>}</div></section></div>;
}
