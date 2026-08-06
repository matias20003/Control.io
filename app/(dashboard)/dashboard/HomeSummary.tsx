import Link from "next/link";
import {
  ArrowRight, CalendarDays, Check, Flame, HeartHandshake, Newspaper, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { AgendaEvent } from "@/lib/db/agenda";
import type { OrganizationTask } from "@/lib/db/organization";
import { summarizeOrganization, type HabitLike } from "@/lib/organization-summary";
import { cadenceState, sinceLabel } from "@/lib/circle-cadence";
import type { CurrencyPosition } from "@/lib/net-worth";
import { HomeNetWorth } from "./HomeNetWorth";

/**
 * Inicio: un bloque por pilar, cada uno con su número y su forma.
 *
 * Cada tarjeta se lee en dos tiempos: arriba el titular, que contesta "¿hay
 * algo que mirar?", y abajo un gráfico que contesta "¿y cómo viene?". Un
 * resumen de puros números obliga a comparar de memoria; una barra alta al lado
 * de una baja se entiende sin leer.
 *
 * Los gráficos son divs y SVG a mano, sin librería: son tres formas simples y
 * cargar un motor de gráficos entero en la pantalla que más se abre costaría
 * más de lo que rinde.
 */

const TZ = "America/Argentina/Buenos_Aires";
const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TZ });
const WEEKDAY_LABEL = ["L", "M", "M", "J", "V", "S", "D"];

type Contact = {
  id: string;
  name: string;
  cadenceDays: number;
  lastContactAt: string | Date | null;
  createdAt: string | Date;
};

export type MonthPoint = { label: string; income: number; expense: number };

function Pillar({ title, href, icon: Icon, children, footer }: {
  title: string; href: string; icon: React.ElementType;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <section className="dashboard-panel flex flex-col rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon size={15} className="text-primary" /> {title}
        </h2>
        <Link href={href} aria-label={`Ir a ${title}`} className="text-muted transition-colors hover:text-primary">
          <ArrowRight size={15} />
        </Link>
      </div>
      <div className="flex-1 space-y-3">{children}</div>
      {footer && <div className="mt-3 border-t border-border pt-3">{footer}</div>}
    </section>
  );
}

function Line({ value, detail, tone }: { value: string; detail: string; tone?: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold tabular-nums ${tone ?? "text-foreground"}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{detail}</p>
    </div>
  );
}

/** Título chico sobre cada gráfico: sin él una barra suelta no dice de qué habla. */
function ChartTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</p>;
}

/**
 * Seis meses de entradas y salidas, una barra doble por mes.
 *
 * Todas las barras se miden contra el mismo máximo: escalar cada mes por
 * separado haría que un mes flojo se viera igual de alto que uno bueno.
 */
function MonthBars({ points }: { points: MonthPoint[] }) {
  const max = Math.max(1, ...points.flatMap((point) => [point.income, point.expense]));
  return (
    <div>
      <ChartTitle>Últimos meses</ChartTitle>
      <div className="flex h-20 items-end gap-1.5">
        {points.map((point, index) => (
          <div key={`${point.label}-${index}`} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-16 w-full items-end justify-center gap-0.5">
              <span
                title={`Entró ${formatCurrency(point.income, "ARS")}`}
                className="w-1/2 rounded-t-sm bg-success/70"
                style={{ height: `${Math.max(2, (point.income / max) * 100)}%` }}
              />
              <span
                title={`Salió ${formatCurrency(point.expense, "ARS")}`}
                className="w-1/2 rounded-t-sm bg-danger/70"
                style={{ height: `${Math.max(2, (point.expense / max) * 100)}%` }}
              />
            </div>
            <span className="text-[9px] uppercase text-muted">{point.label.slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-3 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success/70" /> entró</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-danger/70" /> salió</span>
      </div>
    </div>
  );
}

/** En qué se va la plata: las tres categorías más pesadas del mes. */
function TopCategories({ items }: { items: { name: string; total: number; color: string }[] }) {
  if (items.length === 0) return null;
  const max = Math.max(1, ...items.map((item) => item.total));
  return (
    <div>
      <ChartTitle>En qué se va</ChartTitle>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.name}>
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="truncate text-muted">{item.name}</span>
              <span className="shrink-0 tabular-nums text-foreground">{formatCurrency(item.total, "ARS")}</span>
            </div>
            <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(item.total / max) * 100}%`, background: item.color || "var(--color-primary)" }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * La semana: tareas arriba, plata abajo, un día por columna.
 *
 * Es el único gráfico del producto donde el tiempo y el dinero comparten eje, y
 * la razón de que exista el Inicio: ver que el martes viene cargado *y* caro es
 * una conclusión que ninguna de las dos secciones da por separado.
 */
function WeekBars({ days }: {
  days: { day: string; count: number; isToday: boolean; outflow: number }[];
}) {
  const maxCount = Math.max(1, ...days.map((entry) => entry.count));
  const maxOut = Math.max(0, ...days.map((entry) => entry.outflow));
  return (
    <div>
      <ChartTitle>Tu semana</ChartTitle>
      <div className="flex h-20 items-end gap-1">
        {days.map((entry, index) => (
          <div key={entry.day} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-12 w-full items-end justify-center">
              <span
                title={`${entry.count} tarea${entry.count === 1 ? "" : "s"}`}
                className={`w-full rounded-t-sm ${entry.isToday ? "bg-primary" : "bg-primary/40"}`}
                style={{ height: `${Math.max(3, (entry.count / maxCount) * 100)}%` }}
              />
            </div>
            {/* La plata del día como una línea roja bajo la barra: cuanto más
                gruesa, más caro. El día más caro se marca lleno. */}
            <span
              title={entry.outflow > 0 ? `Vence ${formatCurrency(entry.outflow, "ARS")}` : "Sin vencimientos"}
              className={`h-1 w-full rounded-full ${
                entry.outflow > 0 && entry.outflow >= maxOut ? "bg-danger" : entry.outflow > 0 ? "bg-danger/40" : "bg-surface-2"
              }`}
            />
            <span className={`text-[9px] ${entry.isToday ? "font-bold text-primary" : "text-muted"}`}>
              {WEEKDAY_LABEL[index]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Anillo de progreso para los hábitos del día. */
function HabitRing({ done, total, strength }: { done: number; total: number; strength: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? done / total : 0;
  return (
    <div className="flex items-center gap-3">
      <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0 -rotate-90">
        <circle cx="28" cy="28" r={radius} fill="none" strokeWidth="5" className="stroke-surface-2" />
        <circle
          cx="28" cy="28" r={radius} fill="none" strokeWidth="5" strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset]"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
      <div>
        <p className="text-sm font-semibold text-foreground">{done}/{total} hábitos</p>
        <p className="inline-flex items-center gap-1 text-[11px] text-muted">
          <Flame size={11} className="text-amber-500" /> fuerza {strength}/100
        </p>
      </div>
    </div>
  );
}

/** Cómo están los vínculos: al día, por vencer, o esperando hace rato. */
function CircleBars({ ok, soon, due }: { ok: number; soon: number; due: number }) {
  const total = ok + soon + due;
  if (total === 0) return null;
  const bar = (value: number, tone: string) =>
    value > 0 ? <span className={`block h-full ${tone}`} style={{ width: `${(value / total) * 100}%` }} /> : null;
  return (
    <div>
      <ChartTitle>Tu círculo</ChartTitle>
      <span className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        {bar(ok, "bg-success")}
        {bar(soon, "bg-amber-500")}
        {bar(due, "bg-danger")}
      </span>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success" /> {ok} al día</span>
        {soon > 0 && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" /> {soon} pronto</span>}
        {due > 0 && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-danger" /> {due} esperando</span>}
      </div>
    </div>
  );
}

export function HomeSummary({
  month, positions, agenda, tasks, habits, contacts, showCircle, trend, balanceSeries, topCategories,
}: {
  month: { totalIncome: number; totalExpense: number; balance: number };
  positions: CurrencyPosition[];
  agenda: AgendaEvent[];
  tasks: OrganizationTask[];
  habits: HabitLike[];
  contacts: Contact[];
  showCircle: boolean;
  trend: MonthPoint[];
  balanceSeries: { label: string; balance: number }[];
  topCategories: { name: string; total: number; color: string }[];
}) {
  const today = dayKey(new Date());
  const org = summarizeOrganization(tasks, habits, today);

  const outflowOn = (day: string) =>
    agenda
      .filter((event) => dayKey(new Date(event.date)) === day && event.cashFlow === "expense" && event.currency === "ARS")
      .reduce((sum, event) => sum + event.amount, 0);

  const weekDays = org.week.days.map((entry) => ({ ...entry, outflow: outflowOn(entry.day) }));
  const next7 = agenda.filter((event) => event.daysUntil >= 0 && event.daysUntil <= 7);
  const outflow7 = next7
    .filter((event) => event.cashFlow === "expense" && event.currency === "ARS")
    .reduce((sum, event) => sum + event.amount, 0);
  const todayOutflow = outflowOn(today);

  // Los vínculos con el mismo motor que usa Cercanos: así el Inicio no puede
  // contradecir a la sección.
  const now = new Date();
  const states = showCircle
    ? contacts.map((contact) => ({
        ...contact,
        state: cadenceState(
          {
            cadenceDays: contact.cadenceDays,
            lastContactAt: contact.lastContactAt ? new Date(contact.lastContactAt) : null,
            createdAt: new Date(contact.createdAt),
          },
          now,
        ),
      }))
    : [];
  const due = states.filter((contact) => contact.state.isDue).sort((a, b) => b.state.overdueDays - a.state.overdueDays);
  // "Pronto" es el último quinto de la cadencia: ya casi toca, todavía no.
  const soon = states.filter(
    (contact) => !contact.state.isDue && contact.state.overdueDays >= -Math.ceil(contact.cadenceDays / 5),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ── Finanzas ── */}
      <Pillar
        title="Finanzas" href="/finanzas" icon={Wallet}
        footer={
          outflow7 > 0 ? (
            <p className="text-xs text-muted">
              Los próximos 7 días salen{" "}
              <span className="font-semibold tabular-nums text-danger">{formatCurrency(outflow7, "ARS")}</span>
              {next7[0] && <> · lo primero: {next7[0].title} {next7[0].dateLabel.toLowerCase()}</>}
            </p>
          ) : (
            <p className="text-xs text-muted">No hay vencimientos en los próximos 7 días.</p>
          )
        }
      >
        <HomeNetWorth
          positions={positions}
          monthlyBalances={balanceSeries}
          monthBalance={month.balance}
        />
        {trend.length > 1 && <MonthBars points={trend} />}
        <TopCategories items={topCategories} />
      </Pillar>

      {/* ── Organización ── */}
      <Pillar
        title="Organización" href="/organizacion" icon={CalendarDays}
        footer={
          org.inbox > 0 ? (
            <p className="text-xs text-muted">{org.inbox} sin día en el Inbox · asignales uno al planificar la semana</p>
          ) : (
            <p className="text-xs text-muted">Todo lo pendiente tiene día asignado.</p>
          )
        }
      >
        <Line
          value={String(org.today.total)}
          detail={
            org.today.total === 0
              ? "Nada para hoy. Disfrutalo o planificá algo."
              : `Para hoy${org.today.timed > 0 ? ` · ${org.today.timed} con hora` : ""}`
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          {org.doneToday > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              <Check size={12} /> {org.doneToday} listas hoy
            </span>
          )}
          {todayOutflow > 0 && (
            <span className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger">
              hoy vence {formatCurrency(todayOutflow, "ARS")}
            </span>
          )}
        </div>
        <WeekBars days={weekDays} />
        {org.habits.due > 0 && (
          <HabitRing done={org.habits.done} total={org.habits.due} strength={org.habits.strength} />
        )}
      </Pillar>

      {/* ── Mi Círculo ── */}
      <Pillar
        title="Mi Círculo" href="/circulo" icon={HeartHandshake}
        footer={
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Newspaper size={12} /> Tu ración del día te espera
          </p>
        }
      >
        {showCircle && due.length > 0 ? (
          <>
            <Line
              value={due.length === 1 ? "1 persona" : `${due.length} personas`}
              detail="Hace rato que no hablás con ellas"
            />
            <ul className="space-y-1 text-xs text-muted">
              {due.slice(0, 3).map((contact) => (
                <li key={contact.id} className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium text-foreground">{contact.name}</span>
                  <span className="shrink-0">{sinceLabel(contact.state.daysSince, contact.state.neverContacted)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : showCircle && states.length > 0 ? (
          <Line value="Al día" detail="No hay vínculos esperando" tone="text-success" />
        ) : (
          <Line value="Tu ración" detail="Lo que elegiste leer, y termina" />
        )}
        <CircleBars ok={states.length - due.length - soon.length} soon={soon.length} due={due.length} />
      </Pillar>
    </div>
  );
}
