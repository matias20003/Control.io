"use client";

// Primera pestaña del admin: un resumen de todas las demás ventanas. Cada
// tarjeta muestra el número clave de una sección y, al tocarla, salta a esa
// ventana (onNavigate lo maneja AdminShell). No hace fetch: recibe los números
// ya calculados en el server.

import {
  TrendingUp, Users, BarChart3, RotateCcw, MessageSquareText,
  ListChecks, MessageCircle, Wrench, ArrowRight,
} from "lucide-react";

export type SummaryData = {
  totalUsers: number;
  nsm: number;
  wau: number;
  mau: number;
  stickiness: number;
  activationRate: number;
  activatedUsers: number;
  signups7d: number;
  premiumActive: number;
  conversion: number;
  dormant30plus: number;
  neverActivated: number;
  txThisMonth: number;
  txLast30: number;
  waitlistTotal: number;
  waitlistWeek: number;
  whatsappUsers: number;
  whatsappPercent: number;
  feedbackCount: number;
  updatedAt: string;
};

function fmt(n: number) {
  return n.toLocaleString("es-AR");
}

/* Mini-métrica dentro de una tarjeta de sección */
function Metric({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div className="min-w-0">
      <p className={`text-xl font-bold font-mono tabular-nums leading-none ${accent ?? "text-foreground"}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted truncate">{label}</p>
    </div>
  );
}

/* Tarjeta-acceso a una sección */
function SectionCard({
  icon: Icon, title, onClick, children, accent,
}: {
  icon: typeof TrendingUp;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border border-border bg-surface p-4 hover:border-primary/50 hover:bg-surface-2/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${accent}`}>
          <Icon className="h-4 w-4" />
          {title}
        </span>
        <ArrowRight className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
      </div>
      <div className="grid grid-cols-3 gap-3">{children}</div>
    </button>
  );
}

export function DashboardSummary({
  data, onNavigate,
}: { data: SummaryData; onNavigate: (key: string) => void }) {
  return (
    <div className="space-y-6">
      {/* Hero: North Star */}
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> North Star
            </p>
            <p className="mt-2 text-5xl font-bold font-mono tabular-nums text-foreground">{fmt(data.nsm)}</p>
            <p className="mt-1 text-sm text-muted">Usuarios activos que registran su plata esta semana</p>
          </div>
          <div className="grid grid-cols-3 gap-4 md:gap-6">
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-foreground">{fmt(data.wau)}</p>
              <p className="text-[11px] text-muted">Activos 7d</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-success">{data.activationRate}%</p>
              <p className="text-[11px] text-muted">Activación</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-foreground">{data.stickiness}%</p>
              <p className="text-[11px] text-muted">Stickiness</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de accesos a cada ventana */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SectionCard icon={TrendingUp} title="Negocio" accent="text-primary" onClick={() => onNavigate("negocio")}>
          <Metric value={fmt(data.nsm)} label="North Star" accent="text-primary" />
          <Metric value={`${data.activationRate}%`} label="Activación" accent="text-success" />
          <Metric value={`${data.conversion}%`} label="Premium" />
        </SectionCard>

        <SectionCard icon={Users} title="Usuarios" accent="text-sky-400" onClick={() => onNavigate("usuarios")}>
          <Metric value={fmt(data.totalUsers)} label="Registrados" />
          <Metric value={fmt(data.activatedUsers)} label="Activados" accent="text-success" />
          <Metric value={fmt(data.dormant30plus)} label="Dormidos 30d+" accent="text-warning" />
        </SectionCard>

        <SectionCard icon={BarChart3} title="Analítica" accent="text-violet-400" onClick={() => onNavigate("analitica")}>
          <Metric value={fmt(data.signups7d)} label="Altas 7d" />
          <Metric value={fmt(data.txThisMonth)} label="Movim. mes" />
          <Metric value={fmt(data.txLast30)} label="Movim. 30d" />
        </SectionCard>

        <SectionCard icon={RotateCcw} title="Reactivación" accent="text-amber-400" onClick={() => onNavigate("reactivacion")}>
          <Metric value={fmt(data.dormant30plus)} label="Dormidos" accent="text-warning" />
          <Metric value={fmt(data.neverActivated)} label="Sin activar" accent="text-danger" />
          <Metric value={fmt(data.whatsappUsers)} label="Con WhatsApp" />
        </SectionCard>

        <SectionCard icon={MessageSquareText} title="Feedback" accent="text-emerald-400" onClick={() => onNavigate("feedback")}>
          <Metric value={fmt(data.feedbackCount)} label="Comentarios" />
          <Metric value={fmt(data.waitlistWeek)} label="Waitlist 7d" />
          <Metric value={fmt(data.signups7d)} label="Altas 7d" />
        </SectionCard>

        <SectionCard icon={ListChecks} title="Waitlist" accent="text-cyan-400" onClick={() => onNavigate("waitlist")}>
          <Metric value={fmt(data.waitlistTotal)} label="Anotados" accent="text-primary" />
          <Metric value={fmt(data.waitlistWeek)} label="Esta semana" />
          <Metric value={fmt(data.neverActivated)} label="Sin activar" />
        </SectionCard>

        <SectionCard icon={MessageCircle} title="WhatsApp" accent="text-green-400" onClick={() => onNavigate("whatsapp")}>
          <Metric value={fmt(data.whatsappUsers)} label="Usuarios" />
          <Metric
            value={`${data.whatsappPercent}%`}
            label="Uso del plan"
            accent={data.whatsappPercent >= 80 ? "text-danger" : data.whatsappPercent >= 60 ? "text-warning" : "text-success"}
          />
          <Metric value={fmt(data.mau)} label="Activos mes" />
        </SectionCard>

        <SectionCard icon={Wrench} title="Herramientas" accent="text-slate-400" onClick={() => onNavigate("herramientas")}>
          <div className="col-span-3 flex items-center text-sm text-muted">
            Migración de datos, reparaciones y reactivación manual.
          </div>
        </SectionCard>
      </div>

      <p className="text-center text-[11px] text-muted">Actualizado {data.updatedAt}</p>
    </div>
  );
}
