"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Circle, Wallet, ArrowUpDown, Bell, Tag, MessageCircle, X, Sparkles } from "lucide-react";
import type { OnboardingState } from "@/lib/db/onboarding";
import { NOTICE_BODY, NOTICE_DISMISS, NOTICE_ICON, NOTICE_TITLE } from "@/components/notice";

const SKIP_KEY = "control:onboarding-dismissed";

interface Props {
  state: OnboardingState;
  /** Abierto de entrada durante el tour guiado, que apunta a cada paso. */
  defaultOpen?: boolean;
}

export function OnboardingChecklist({ state, defaultOpen = false }: Props) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(defaultOpen);

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
      tour: "onb-whatsapp",
      done: state.hasWhatsapp,
      title: "Conectá WhatsApp 💬",
      body: "Cargá gastos por chat: un texto, un audio o la foto de un ticket y se registra solo.",
      icon: MessageCircle,
      cta: { label: "Vincular", href: "/configuracion?tab=perfil" },
    },
    {
      tour: "onb-categories",
      done: state.hasCustomCategory,
      title: "Armá tus categorías",
      body: "Sumá tus categorías de gastos e ingresos para ordenar tu plata a tu manera.",
      icon: Tag,
      cta: { label: "Personalizar", href: "/configuracion?tab=categorias" },
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
      body: "Te avisamos de presupuestos, gastos fijos y vencimientos.",
      icon: Bell,
      cta: { label: "Activar", href: "/configuracion" },
    },
  ];

  return (
    <section>
      {/* Cabecera: colapsada muestra solo el avance. Los pasos se despliegan
          acá abajo, sin sacar al usuario del dashboard. */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`${NOTICE_ICON} bg-primary/12 text-primary`}>
          <Sparkles size={17} strokeWidth={2.2} />
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className={`block ${NOTICE_TITLE}`}>Primeros pasos en control.io</span>
            <span className={`block ${NOTICE_BODY}`}>
              {state.completedCount} de {state.totalSteps} completos
            </span>
            <span className="mt-2 block h-1 max-w-44 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>

        <button
          onClick={() => {
            localStorage.setItem(SKIP_KEY, "1");
            setDismissed(true);
          }}
          className={NOTICE_DISMISS}
          title="Ocultar tutorial"
          aria-label="Ocultar tutorial"
        >
          <X size={15} />
        </button>
      </div>

      {open && (
        <ol className="space-y-2 px-4 pb-4">
          {steps.map((step, i) => (
            <li
              key={i}
              data-tour={step.tour}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                step.done
                  ? "border-success/20 bg-success/5"
                  : "border-border bg-surface-2/40 hover:border-primary/40"
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" strokeWidth={2.2} />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
              )}

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium leading-tight ${
                    step.done ? "text-muted line-through decoration-success/50" : "text-foreground"
                  }`}
                >
                  {step.title}
                </p>
                {!step.done && <p className={NOTICE_BODY}>{step.body}</p>}
              </div>

              {!step.done && (
                <Link
                  href={step.cta.href}
                  className="shrink-0 self-center whitespace-nowrap text-xs font-semibold text-primary transition-colors hover:text-primary-dark"
                >
                  {step.cta.label} →
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
