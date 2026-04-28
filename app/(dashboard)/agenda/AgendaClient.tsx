"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { AgendaEvent } from "@/lib/db/agenda";
import { CalendarClock, CreditCard, Repeat2, HandCoins } from "lucide-react";

interface Props { events: AgendaEvent[] }

const TYPE_ICONS: Record<string, React.ElementType> = {
  credit:    CreditCard,
  debt:      HandCoins,
  recurring: Repeat2,
};

function groupByDate(events: AgendaEvent[]) {
  const map: Record<string, AgendaEvent[]> = {};
  for (const e of events) {
    const key = e.dateLabel;
    map[key] = map[key] ?? [];
    map[key].push(e);
  }
  return map;
}

export function AgendaClient({ events }: Props) {
  if (!events.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CalendarClock size={48} className="text-muted mb-4 opacity-40" />
        <h2 className="text-lg font-bold text-foreground mb-1">Sin eventos próximos</h2>
        <p className="text-sm text-muted max-w-xs">
          Cuando tengas cuotas, deudas o recurrentes programados aparecerán acá.
        </p>
      </div>
    );
  }

  const today    = events.filter((e) => e.daysUntil === 0);
  const upcoming = events.filter((e) => e.daysUntil > 0);
  const grouped  = groupByDate(upcoming);

  const totalPending = events.reduce((s, e) => {
    if (e.type === "debt" && e.color === "#ef4444") return s + e.amount; // debts I owe
    if (e.type === "credit") return s + e.amount;
    return s;
  }, 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
        <p className="text-sm text-muted mt-0.5">Próximos 30 días · {events.length} eventos</p>
      </div>

      {/* Summary */}
      {totalPending > 0 && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-0.5">Por pagar (30 días)</p>
            <p className="text-xl font-bold font-mono text-danger">{formatCurrency(totalPending, "ARS")}</p>
          </div>
          <CalendarClock size={28} className="text-danger opacity-40" />
        </div>
      )}

      {/* Today */}
      {today.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-2">⚡ Hoy</p>
          <div className="space-y-2">
            {today.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </section>
      )}

      {/* Upcoming grouped */}
      {Object.entries(grouped).map(([label, evts]) => (
        <section key={label}>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 capitalize">{label}</p>
          <div className="space-y-2">
            {evts.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventCard({ event: e }: { event: AgendaEvent }) {
  const Icon = TYPE_ICONS[e.type] ?? Repeat2;
  const urgency = e.daysUntil === 0 ? "border-danger/30 bg-danger/5" : e.daysUntil <= 3 ? "border-warning/30" : "";

  return (
    <Card className={urgency}>
      <CardContent className="p-3.5 flex items-center gap-3">
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
          style={{ backgroundColor: `${e.color}20` }}
        >
          {e.icon.length <= 2 ? e.icon : <Icon size={16} style={{ color: e.color }} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight truncate">{e.title}</p>
          <p className="text-xs text-muted">{e.subtitle}</p>
        </div>

        {/* Amount + days */}
        <div className="text-right shrink-0">
          <p className="text-sm font-bold font-mono" style={{ color: e.color }}>
            {formatCurrency(e.amount, e.currency)}
          </p>
          <p className="text-[10px] text-muted">
            {e.daysUntil === 0 ? "Hoy" : `en ${e.daysUntil}d`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
