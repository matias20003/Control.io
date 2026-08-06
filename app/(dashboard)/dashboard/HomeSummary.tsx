import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Flame, HeartHandshake, Newspaper, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { AgendaEvent } from "@/lib/db/agenda";
import type { OrganizationTask } from "@/lib/db/organization";
import { summarizeOrganization, type HabitLike } from "@/lib/organization-summary";
import { cadenceState, sinceLabel } from "@/lib/circle-cadence";

/**
 * Inicio: un bloque por pilar, cada uno respondiendo su pregunta y nada más.
 *
 * No repite los tableros de adentro — los resume. La pregunta que contesta es
 * "¿hay algo que mirar hoy?", y si la respuesta es no, tiene que poder decirlo
 * sin llenar la pantalla de números.
 */

const TZ = "America/Argentina/Buenos_Aires";
const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TZ });

type Contact = {
  id: string;
  name: string;
  cadenceDays: number;
  lastContactAt: string | Date | null;
  createdAt: string | Date;
};

function Pillar({ title, href, icon: Icon, children }: {
  title: string; href: string; icon: React.ElementType; children: React.ReactNode;
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
      <div className="flex-1 space-y-2">{children}</div>
    </section>
  );
}

/** Una línea de "titular + detalle", que es como se lee un resumen. */
function Line({ value, detail, tone }: { value: string; detail: string; tone?: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold tabular-nums ${tone ?? "text-foreground"}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{detail}</p>
    </div>
  );
}

export function HomeSummary({
  month, netWorth, agenda, tasks, habits, contacts, showCircle,
}: {
  month: { totalIncome: number; totalExpense: number; balance: number };
  netWorth: number | null;
  agenda: AgendaEvent[];
  tasks: OrganizationTask[];
  habits: HabitLike[];
  contacts: Contact[];
  showCircle: boolean;
}) {
  const today = dayKey(new Date());
  const org = summarizeOrganization(tasks, habits, today);

  const next7 = agenda.filter((event) => event.daysUntil >= 0 && event.daysUntil <= 7);
  const outflow7 = next7
    .filter((event) => event.cashFlow === "expense" && event.currency === "ARS")
    .reduce((sum, event) => sum + event.amount, 0);
  const todayOutflow = agenda
    .filter((event) => event.daysUntil === 0 && event.cashFlow === "expense" && event.currency === "ARS")
    .reduce((sum, event) => sum + event.amount, 0);

  // Los vínculos que tocan hoy, con el mismo motor que usa Cercanos: así el
  // Inicio no puede contradecir a la sección.
  const now = new Date();
  const due = showCircle
    ? contacts
        .map((contact) => ({
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
        .filter((contact) => contact.state.isDue)
        .sort((a, b) => b.state.overdueDays - a.state.overdueDays)
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ── Finanzas ── */}
      <Pillar title="Finanzas" href="/finanzas" icon={Wallet}>
        <Line
          value={formatCurrency(month.balance, "ARS")}
          detail={`Balance del mes · ${formatCurrency(month.totalIncome, "ARS")} entró, ${formatCurrency(month.totalExpense, "ARS")} salió`}
          tone={month.balance >= 0 ? "text-success" : "text-danger"}
        />
        <p className="flex items-center gap-1.5 text-xs text-muted">
          {month.balance >= 0
            ? <><TrendingUp size={12} className="text-success" /> Vas en positivo este mes</>
            : <><TrendingDown size={12} className="text-danger" /> Estás gastando más de lo que entra</>}
        </p>
        {netWorth !== null && (
          <p className="text-xs text-muted">
            Patrimonio: <span className="font-medium text-foreground">{formatCurrency(netWorth, "ARS")}</span>
          </p>
        )}
        {outflow7 > 0 && (
          <p className="rounded-lg bg-surface-2/60 px-2.5 py-2 text-xs text-muted">
            Los próximos 7 días salen{" "}
            <span className="font-semibold tabular-nums text-danger">{formatCurrency(outflow7, "ARS")}</span>
            {next7[0] && <> · lo primero: {next7[0].title} {next7[0].dateLabel.toLowerCase()}</>}
          </p>
        )}
      </Pillar>

      {/* ── Organización ── */}
      <Pillar title="Organización" href="/organizacion" icon={CalendarDays}>
        <Line
          value={String(org.today.total)}
          detail={
            org.today.total === 0
              ? "Nada para hoy. Disfrutalo o planificá algo."
              : `Para hoy${org.today.timed > 0 ? ` · ${org.today.timed} con hora` : ""}`
          }
        />
        {org.doneToday > 0 && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <Check size={12} /> {org.doneToday} listas hoy
          </p>
        )}
        {todayOutflow > 0 && (
          // El cruce, dicho en una línea: hoy además de tareas, sale plata.
          <p className="rounded-lg bg-surface-2/60 px-2.5 py-2 text-xs text-muted">
            Hoy además vence{" "}
            <span className="font-semibold tabular-nums text-danger">{formatCurrency(todayOutflow, "ARS")}</span>
          </p>
        )}
        {org.habits.due > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Flame size={12} className="text-amber-500" />
            Hábitos {org.habits.done}/{org.habits.due}
            {org.habits.pending > 0 && org.habits.pendingHabits[0] && (
              <> · falta {org.habits.pendingHabits[0].name}</>
            )}
          </p>
        )}
        {org.inbox > 0 && (
          <p className="text-xs text-muted">{org.inbox} sin día en el Inbox</p>
        )}
      </Pillar>

      {/* ── Mi Círculo ── */}
      <Pillar title="Mi Círculo" href="/circulo" icon={HeartHandshake}>
        {showCircle && due.length > 0 ? (
          <>
            <Line
              value={due.length === 1 ? "1 persona" : `${due.length} personas`}
              detail="Hace rato que no hablás con ellas"
            />
            <ul className="space-y-1 text-xs text-muted">
              {due.slice(0, 2).map((contact) => (
                <li key={contact.id} className="truncate">
                  <span className="font-medium text-foreground">{contact.name}</span>
                  {" · "}{sinceLabel(contact.state.daysSince, contact.state.neverContacted)}
                </li>
              ))}
            </ul>
          </>
        ) : showCircle ? (
          <Line value="Al día" detail="No hay vínculos esperando" tone="text-success" />
        ) : (
          <Line value="Tu ración" detail="Lo que elegiste leer, y termina" />
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Newspaper size={12} /> Tu ración del día te espera
        </p>
      </Pillar>
    </div>
  );
}
