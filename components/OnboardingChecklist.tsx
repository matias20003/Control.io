"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Wallet, ArrowUpDown, Bell, X, Sparkles } from "lucide-react";
import type { OnboardingState } from "@/lib/db/onboarding";

const SKIP_KEY = "control:onboarding-dismissed";

interface Props {
  state: OnboardingState;
}

export function OnboardingChecklist({ state }: Props) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  // Persistimos la decisión "saltar" en localStorage para que no vuelva a
  // aparecer aunque queden pasos sin cubrir. null = SSR, todavía no leímos.
  useEffect(() => {
    setDismissed(localStorage.getItem(SKIP_KEY) === "1");
  }, []);

  // Mientras leemos localStorage, NO renderizamos nada para evitar parpadeo.
  if (dismissed === null) return null;

  // Si ya lo descartó, o si ya completó todos los pasos, no mostramos nada.
  if (dismissed) return null;
  if (state.isComplete) return null;

  const pct = Math.round((state.completedCount / state.totalSteps) * 100);

  const steps = [
    {
      tour: "onb-account",
      done: state.hasAccount,
      title: "Creá tu primera cuenta",
      body: "Un banco, MercadoPago, USD en mano — lo que tengas.",
      icon: Wallet,
      cta: { label: "Crear cuenta", href: "/cuentas" },
    },
    {
      tour: "onb-transaction",
      done: state.hasTransaction,
      title: "Cargá tu primer movimiento",
      body: "Un ingreso o gasto. Recién ahí ves el dashboard con vida.",
      icon: ArrowUpDown,
      cta: { label: "Nuevo movimiento", href: "/movimientos" },
    },
    {
      tour: "onb-notifications",
      done: state.hasPushSubscription,
      title: "Activá las notificaciones",
      body: "Te avisamos de presupuestos, recurrentes y vencimientos.",
      icon: Bell,
      cta: { label: "Activar", href: "/configuracion" },
    },
  ];

  return (
    <section className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.10] via-primary/[0.05] to-transparent p-5 overflow-hidden">
      {/* Decoración: glow sutil arriba a la derecha */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full blur-3xl opacity-50"
        style={{ background: "oklch(0.67 0.19 258)" }}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">
              Primeros pasos en control.io
            </p>
            <p className="text-xs text-muted mt-0.5">
              {state.completedCount} de {state.totalSteps} completos · {pct}%
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(SKIP_KEY, "1");
            setDismissed(true);
          }}
          className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
          title="Ocultar tutorial"
          aria-label="Ocultar tutorial"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full bg-surface-2 overflow-hidden mb-5">
        <div
          className="h-full bg-gradient-to-r from-primary to-[oklch(0.72_0.15_220)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps list */}
      <ol className="relative space-y-2.5">
        {steps.map((step, i) => (
          <li
            key={i}
            data-tour={step.tour}
            className={`flex items-start gap-3 rounded-xl p-3 transition-colors ${
              step.done
                ? "bg-success/5 border border-success/20"
                : "bg-surface border border-border hover:border-primary/40"
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" strokeWidth={2.2} />
            ) : (
              <Circle className="h-5 w-5 text-muted shrink-0 mt-0.5" />
            )}

            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium leading-tight ${
                  step.done ? "text-muted line-through decoration-success/50" : "text-foreground"
                }`}
              >
                {step.title}
              </p>
              {!step.done && (
                <p className="text-xs text-muted mt-1 leading-snug">{step.body}</p>
              )}
            </div>

            {!step.done && (
              <Link
                href={step.cta.href}
                className="shrink-0 self-center text-xs font-semibold text-primary hover:text-primary-dark transition-colors whitespace-nowrap"
              >
                {step.cta.label} →
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
