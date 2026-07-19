"use client";

import { useRef } from "react";
import { Mail, Undo2, Clock, TrendingUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimelineAnimation } from "@/components/ui/advanced-stats-utils/timeline-animation";
import type { ReactivationFollowup as Data } from "@/lib/db/reactivation-followup";

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "hace minutos";
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export function ReactivationFollowup({ data }: { data: Data }) {
  const ref = useRef<HTMLDivElement>(null);

  if (data.emailed === 0) return null;

  const kpis = [
    { label: "Correos enviados", value: data.emailed, icon: Mail, accent: "neutral" as const },
    { label: "Volvieron", value: data.returned, icon: Undo2, accent: "up" as const },
    { label: "Esperando", value: data.waiting, icon: Clock, accent: "wait" as const },
    { label: "Conversión", value: `${data.conversion}%`, icon: TrendingUp, accent: "up" as const },
  ];

  return (
    <section ref={ref} className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
        Seguimiento de reactivación
      </h2>

      {/* Hero de conversión + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hero (col-span-2) */}
        <TimelineAnimation
          animationNum={1}
          timelineRef={ref}
          className="lg:col-span-2 p-7 rounded-3xl bg-gradient-to-br from-[#2563EB] to-[#1e3a8a] text-white shadow-lg flex flex-col justify-between overflow-hidden relative"
        >
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200/80 mb-2">
              Campaña de reactivación
            </p>
            <h3 className="text-xl font-bold tracking-tight">
              {data.returned} de {data.emailed} volvieron
            </h3>
            <p className="text-sm text-blue-100/80 mt-1">
              Usuarios inactivos que retomaron la app después del correo.
            </p>
          </div>
          <div className="mt-8 relative">
            <div className="flex justify-between items-end mb-2">
              <span className="text-5xl font-black tracking-tighter tabular-nums">
                {data.conversion}%
              </span>
              <span className="text-xs font-medium text-blue-100/80 mb-1.5">
                {data.waiting} esperando
              </span>
            </div>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${data.conversion}%` }}
              />
            </div>
          </div>
        </TimelineAnimation>

        {/* KPIs stacked (col 3) */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
          {kpis.slice(1, 3).map((kpi, i) => (
            <TimelineAnimation
              key={kpi.label}
              animationNum={2 + i}
              timelineRef={ref}
              className={cn(
                "p-5 rounded-3xl border bg-surface border-border flex items-center gap-4 transition-colors",
                kpi.accent === "up" ? "hover:border-success/60" : "hover:border-warning/60"
              )}
            >
              <div
                className={cn(
                  "size-10 rounded-xl flex items-center justify-center shrink-0",
                  kpi.accent === "up" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                )}
              >
                <kpi.icon size={18} />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tracking-tighter tabular-nums leading-none">
                  {kpi.value}
                </p>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mt-1">
                  {kpi.label}
                </p>
              </div>
            </TimelineAnimation>
          ))}
        </div>
      </div>

      {/* KPI row inferior */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <TimelineAnimation
            key={kpi.label}
            animationNum={4 + index}
            timelineRef={ref}
            className={cn(
              "p-5 rounded-2xl border bg-surface border-border transition-colors",
              kpi.accent === "up"
                ? "hover:border-success/60 hover:bg-success/5"
                : kpi.accent === "wait"
                  ? "hover:border-warning/60 hover:bg-warning/5"
                  : "hover:border-border-subtle"
            )}
          >
            <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-2">
              {kpi.label}
            </p>
            <p className="text-2xl font-black text-foreground tracking-tighter tabular-nums">
              {kpi.value}
            </p>
          </TimelineAnimation>
        ))}
      </div>

      {/* Lista de seguimiento */}
      <TimelineAnimation
        animationNum={8}
        timelineRef={ref}
        className="rounded-3xl border border-border bg-surface overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Detalle por usuario</p>
          <p className="text-[11px] text-muted">{data.emailed} contactados</p>
        </div>
        <ul className="divide-y divide-border">
          {data.users.map((u) => (
            <li key={u.email} className="px-5 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{u.name || u.email.split("@")[0]}</p>
                <p className="text-[11px] text-muted truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] text-muted hidden sm:inline">
                  enviado {relTime(u.emailedAt)}
                </span>
                {u.returned ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={12} /> Volvió
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                    <Clock size={12} /> Esperando
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </TimelineAnimation>
    </section>
  );
}
