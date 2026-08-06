"use client";

/**
 * La portada del pilar: qué pinta el día, qué pinta la semana, y en qué anda
 * cada cosa. Responde "¿cómo vengo?" de un vistazo y recién después manda a la
 * sección que corresponda.
 *
 * Dos reglas la gobiernan:
 *
 * 1. Sin configurar nada. Un usuario que entra por primera vez ya ve su semana
 *    llena, porque los vencimientos salen de las finanzas que ya cargó. Toda
 *    app de organización arranca con una pantalla en blanco y se gana el
 *    abandono ahí mismo; ésta es la única que puede llegar con contenido propio
 *    en el segundo cero.
 *
 * 2. Nada en rojo por lo que no hiciste. Los números que muestra son de estado,
 *    no de deuda: cuánto hay hoy, cuánto pesa cada día, qué tan afirmados están
 *    los hábitos. Lo que quedó sin hacer ya rodó y está adentro del día.
 */

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Flame, ListChecks, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { toggleHabitAction } from "@/app/actions/organization";
import type { AgendaEvent } from "@/lib/db/agenda";
import type { OrganizationTask } from "@/lib/db/organization";
import { summarizeOrganization, type HabitLike } from "@/lib/organization-summary";

const TZ = "America/Argentina/Buenos_Aires";
const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TZ });

const money = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const WEEKDAY_LABEL = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function Card({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  const body = (
    <section className="dashboard-panel h-full rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/30">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function OrganizationDashboard({ tasks, habits, financeEvents }: {
  tasks: OrganizationTask[];
  habits: HabitLike[];
  financeEvents: AgendaEvent[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = dayKey(new Date());
  const summary = summarizeOrganization(tasks, habits, today);

  const toggleHabit = (habitId: string) => start(async () => {
    const result = await toggleHabitAction(habitId, today);
    if (result.error) toast.error(result.error);
    else router.refresh();
  });

  /** Plata que sale un día. Sólo pesos: mezclar monedas daría un total falso. */
  const outflowOn = (day: string) =>
    financeEvents
      .filter((event) => dayKey(new Date(event.date)) === day && event.cashFlow === "expense" && event.currency === "ARS")
      .reduce((sum, event) => sum + event.amount, 0);

  const todayOutflow = outflowOn(today);
  const weekOutflow = summary.week.days.reduce((sum, entry) => sum + outflowOn(entry.day), 0);
  const heaviestOutflow = Math.max(0, ...summary.week.days.map((entry) => outflowOn(entry.day)));
  const busiestLoad = Math.max(1, ...summary.week.days.map((entry) => entry.count));
  const todayEvents = financeEvents.filter((event) => dayKey(new Date(event.date)) === today);

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 pb-24">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Organización</h1>
        <p className="mt-1 text-sm text-muted">Cómo viene el día y cómo viene la semana.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hoy */}
        <Card title="Hoy" href="/hoy">
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {summary.today.total}
            <span className="ml-1.5 text-sm font-normal text-muted">
              {summary.today.total === 1 ? "cosa para hacer" : "cosas para hacer"}
            </span>
          </p>
          <p className="mt-2 text-xs text-muted">
            {summary.today.timed > 0 && <>{summary.today.timed} con hora · </>}
            {summary.today.untimed} sin hora
            {summary.today.due > 0 && <> · {summary.today.due} vence hoy</>}
          </p>
          {summary.doneToday > 0 && (
            // Lo hecho, dicho en positivo. Es el único contador del tablero que
            // habla de lo que pasó, y por eso es el que conviene mirar.
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              <Check size={12} /> {summary.doneToday} listas hoy
            </p>
          )}
        </Card>

        {/* Plata del día: el cruce que ninguna app de tareas puede copiar. */}
        <Card title="Hoy sale" href="/calendario">
          {todayOutflow > 0 ? (
            <>
              <p className="text-3xl font-bold tabular-nums text-danger">{money(todayOutflow)}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {todayEvents.slice(0, 3).map((event) => (
                  <li key={event.id} className="truncate">{event.title}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-foreground">$0</p>
              <p className="mt-2 text-xs text-muted">
                Hoy no vence nada. {weekOutflow > 0 && <>Esta semana salen {money(weekOutflow)}.</>}
              </p>
            </>
          )}
        </Card>

        {/* Hábitos: accionables desde acá, sin entrar a la sección. */}
        <Card title="Hábitos de hoy">
          {summary.habits.due === 0 ? (
            <>
              <p className="text-sm text-muted">Todavía no tenés hábitos para hoy.</p>
              <Link href="/habitos" className="mt-2 inline-block text-xs font-medium text-primary">
                Crear el primero →
              </Link>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold tabular-nums text-foreground">
                {summary.habits.done}<span className="text-sm font-normal text-muted">/{summary.habits.due}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {summary.habits.pendingHabits.map((habit) => (
                  <button
                    key={habit.id}
                    onClick={() => toggleHabit(habit.id)}
                    disabled={pending}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-xs text-muted transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
                  >
                    <span className="grid h-4 w-4 place-items-center rounded-full border border-border" />
                    {habit.icon ?? "●"} {habit.name}
                    {habit.anchor && <span className="opacity-60">· {habit.anchor}</span>}
                  </button>
                ))}
                {summary.habits.pending === 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                    <Check size={13} /> Todos hechos
                  </span>
                )}
              </div>
              {summary.habits.strength > 0 && (
                <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted">
                  <Flame size={11} className="text-amber-500" />
                  Fuerza promedio {summary.habits.strength}/100
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      {/* La semana: el único lugar del producto donde el tiempo y la plata se
          leen en la misma línea. Arriba lo que sale, abajo lo que hay que hacer. */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Tu semana</h2>
          <Link href="/calendario" className="text-xs font-medium text-primary">Ver calendario →</Link>
        </div>

        {weekOutflow > 0 && (
          <p className="mb-3 text-xs text-muted">
            Salen <span className="font-semibold tabular-nums text-danger">{money(weekOutflow)}</span> en
            vencimientos. El día marcado es el más caro: conviene no cargarlo de tareas.
          </p>
        )}

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {summary.week.days.map((entry, index) => {
            const outflow = outflowOn(entry.day);
            const isHeaviest = outflow > 0 && outflow >= heaviestOutflow;
            return (
              <Link
                key={entry.day}
                href={`/hoy?d=${entry.day}`}
                className={`rounded-xl border p-2 text-center transition-colors hover:border-primary/40 ${
                  entry.isToday ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <p className="text-[10px] uppercase text-muted">{WEEKDAY_LABEL[index]}</p>
                <p className={`text-base font-bold ${entry.isToday ? "text-primary" : "text-foreground"}`}>
                  {Number(entry.day.slice(8))}
                </p>

                {/* Carga de tareas */}
                <span className="mt-1.5 block h-1 rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((entry.count / busiestLoad) * 100)}%` }}
                  />
                </span>
                <p className="mt-1 text-[10px] text-muted">{entry.count}</p>

                {/* Plata del día */}
                {outflow > 0 && (
                  <p
                    className={`mt-1 truncate rounded px-1 py-0.5 text-[9px] font-semibold tabular-nums ${
                      isHeaviest ? "bg-danger/12 text-danger" : "bg-surface-2 text-muted"
                    }`}
                    title={isHeaviest ? "El día más caro de la semana" : undefined}
                  >
                    −{money(outflow)}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Entradas a las secciones, con el estado de cada una. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Hoy" href="/hoy">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground"><Sparkles size={15} className="text-primary" /> Arrancar el día</p>
          <p className="mt-1 text-xs text-muted">{summary.today.total} para hoy</p>
        </Card>
        <Card title="Calendario" href="/calendario">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground"><CalendarDays size={15} className="text-primary" /> Planificar</p>
          <p className="mt-1 text-xs text-muted">{summary.week.total} en la semana</p>
        </Card>
        <Card title="Tareas" href="/tareas">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground"><ListChecks size={15} className="text-primary" /> Clasificar</p>
          <p className="mt-1 text-xs text-muted">
            {summary.inbox > 0 ? `${summary.inbox} sin día` : "Todo tiene día"}
            {summary.someday > 0 && ` · ${summary.someday} en algún día`}
          </p>
        </Card>
        <Card title="Hábitos" href="/habitos">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground"><Flame size={15} className="text-primary" /> Sostener</p>
          <p className="mt-1 text-xs text-muted">
            {summary.habits.due > 0 ? `${summary.habits.done} de ${summary.habits.due} hoy` : "Sin hábitos hoy"}
          </p>
        </Card>
      </div>

      {/* Cierre honesto para el que todavía no cargó nada: el tablero ya le
          mostró algo suyo, así que la invitación no cae en el vacío. */}
      {summary.today.total === 0 && summary.week.total === 0 && summary.habits.due === 0 && (
        <p className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-surface/40 px-4 py-6 text-sm text-muted">
          <Wallet size={16} className="shrink-0 text-primary" />
          Todavía no cargaste tareas ni hábitos. Arriba ya ves tus vencimientos: sumale lo que tenés que hacer y la semana queda completa.
        </p>
      )}
    </main>
  );
}
