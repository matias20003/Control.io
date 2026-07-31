"use client";

// Cáscara del admin: barra lateral izquierda (chips horizontales en mobile) que
// agrupa toda la info en ventanas. La primera es el Dashboard (resumen de todo);
// el resto recibe su contenido ya renderizado en el server como `node`, y acá
// solo mostramos el de la pestaña activa. Así el admin deja de ser una landing
// larguísima y pasa a ser navegable por secciones.

import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, TrendingUp, Users, BarChart3, RotateCcw,
  MessageSquareText, ListChecks, MessageCircle, Wrench, LifeBuoy,
} from "lucide-react";
import { DashboardSummary, type SummaryData } from "./DashboardSummary";

export type AdminSection = { key: string; label: string; node: ReactNode };

const META: Record<string, { icon: typeof LayoutDashboard; desc: string }> = {
  dashboard:    { icon: LayoutDashboard,    desc: "Resumen general" },
  soporte:      { icon: LifeBuoy,           desc: "Tickets de soporte del bot" },
  negocio:      { icon: TrendingUp,         desc: "North Star, embudo, cohortes" },
  usuarios:     { icon: Users,              desc: "Ficha y análisis por usuario" },
  analitica:    { icon: BarChart3,          desc: "Evolución, onboarding, conexiones" },
  reactivacion: { icon: RotateCcw,          desc: "Campaña de recuperación" },
  feedback:     { icon: MessageSquareText,  desc: "Comentarios de testers" },
  waitlist:     { icon: ListChecks,         desc: "Lista de espera" },
  whatsapp:     { icon: MessageCircle,      desc: "Uso del bot" },
  agente:       { icon: MessageCircle,      desc: "Calidad, latencia y acciones de IA" },
  herramientas: { icon: Wrench,             desc: "Mantenimiento de datos" },
};

export function AdminShell({
  summary, sections, userEmail,
}: { summary: SummaryData; sections: AdminSection[]; userEmail: string }) {
  const [active, setActive] = useState("dashboard");

  const tabs: { key: string; label: string; node: ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", node: null },
    ...sections,
  ];
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  const currentDesc = META[active]?.desc ?? "";

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col md:flex-row">
      {/* ── Sidebar (desktop) / barra de chips (mobile) ── */}
      <aside className="md:w-60 md:shrink-0 border-b md:border-b-0 md:border-r border-border bg-surface/40 md:sticky md:top-0 md:h-dvh md:overflow-y-auto">
        <div className="hidden md:flex items-center gap-2 px-4 pt-5 pb-3">
          <span className="h-6 w-6 rounded-lg bg-primary/20 grid place-items-center">
            <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
          </span>
          <span className="text-sm font-bold tracking-tight">control.io <span className="text-muted font-normal">admin</span></span>
        </div>
        <nav className="flex md:flex-col gap-1 p-2 md:px-3 md:pb-6 overflow-x-auto md:overflow-visible">
          {tabs.map((t) => {
            const Icon = META[t.key]?.icon ?? LayoutDashboard;
            const on = t.key === active;
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                  on
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${on ? "text-primary" : ""}`} />
                <span className="flex flex-col items-start leading-tight">
                  <span>{t.label}</span>
                  <span className="hidden md:block text-[10px] font-normal text-muted/60">
                    {META[t.key]?.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Contenido de la ventana activa ── */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 border-b border-border bg-surface/70 backdrop-blur px-4 md:px-8 py-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold leading-tight truncate">{current.label}</h1>
            {currentDesc && <p className="text-[11px] text-muted truncate">{currentDesc}</p>}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden sm:inline text-[11px] text-muted truncate max-w-[30vw]">{userEmail}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-semibold text-success uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 md:px-8 py-6 md:py-8">
          {active === "dashboard" ? (
            <DashboardSummary data={summary} onNavigate={setActive} />
          ) : (
            current.node
          )}
        </div>
      </main>
    </div>
  );
}
