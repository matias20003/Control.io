"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, ArrowRight, ArrowLeft } from "lucide-react";

const SEEN_KEY = "control:tour-done";

type Step = {
  /** Selector del elemento a resaltar. Si falta, el paso va centrado. */
  selector?: string;
  title: string;
  body: string;
};

type Box = { top: number; left: number; width: number; height: number };

function tooltipPos(hole: Box | null): React.CSSProperties {
  const W = 300;
  const H = 180;
  const M = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!hole) {
    return { top: Math.max(M, vh / 2 - H / 2), left: Math.max(M, vw / 2 - W / 2) };
  }
  const left = Math.min(Math.max(M, hole.left), vw - W - M);
  const below = hole.top + hole.height + M;
  const top = below + H < vh ? below : Math.max(M, hole.top - H - M);
  return { top, left };
}

/**
 * Tour guiado para el usuario recién registrado: resalta dónde tocar paso a
 * paso (spotlight + tooltip). Solo corre si `enabled` (viene de ?welcome=1) y
 * no se vio antes (localStorage). Avanza con "Siguiente"; se puede saltar.
 */
export function GuidedTour({ enabled, userName }: { enabled: boolean; userName?: string }) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Box | null>(null);

  const steps: Step[] = [
    {
      title: `¡Bienvenido, ${userName ?? "qué bueno verte"}! 👋`,
      body: "Te muestro en 30 segundos cómo arrancar. Son 5 pasos simples.",
    },
    {
      selector: '[data-tour="onb-account"]',
      title: "Paso 1 · Creá una cuenta",
      body: "Acá cargás tu banco, MercadoPago o el efectivo que tengas. Tocá “Crear cuenta”.",
    },
    {
      selector: '[data-tour="onb-whatsapp"]',
      title: "Paso 2 · Conectá WhatsApp 💬",
      body: "Lo más cómodo: cargá gastos por chat. Mandás un texto, un audio o la foto de un ticket y se registra solo. Vinculá tu número.",
    },
    {
      selector: '[data-tour="onb-categories"]',
      title: "Paso 3 · Armá tus categorías",
      body: "Sumá tus categorías de gastos e ingresos (alquiler, sueldo, salidas…) para que cada movimiento quede ordenado a tu manera.",
    },
    {
      selector: '[data-tour="onb-transaction"]',
      title: "Paso 4 · Cargá un movimiento",
      body: "Un gasto o un ingreso (¡probá por WhatsApp!). Recién ahí el dashboard cobra vida con tus números.",
    },
    {
      selector: '[data-tour="onb-notifications"]',
      title: "Paso 5 · Activá los avisos",
      body: "Te avisamos de vencimientos, presupuestos y recurrentes para que no se te pase nada.",
    },
    {
      title: "¡Eso es todo! 🎉",
      body: "Tip: también podés cargar gastos por WhatsApp — mandá un texto, un audio o la foto de un ticket. ¡A disfrutar!",
    },
  ];

  useEffect(() => setMounted(true), []);

  const finish = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore
    }
    // Sacamos ?welcome=1 de la URL sin recargar.
    try {
      window.history.replaceState({}, "", "/dashboard");
    } catch {
      // ignore
    }
  }, []);

  const next = useCallback(() => {
    setI((prev) => {
      if (prev >= steps.length - 1) {
        finish();
        return prev;
      }
      return prev + 1;
    });
  }, [finish, steps.length]);

  const back = useCallback(() => setI((p) => Math.max(0, p - 1)), []);

  // Arranca solo si está habilitado y no se vio antes.
  useEffect(() => {
    if (!enabled) return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // ignore
    }
    if (seen) return;
    const t = setTimeout(() => setActive(true), 450); // que monte el checklist
    return () => clearTimeout(t);
  }, [enabled]);

  const step = steps[i];

  // Ubica el target del paso (con reintentos si todavía no montó).
  useEffect(() => {
    if (!active) return;
    if (!step.selector) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let tries = 0;
    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector!) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          if (cancelled) return;
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }, 280);
      } else if (tries++ < 12) {
        setTimeout(find, 150);
      } else {
        next(); // no apareció → saltamos el paso
      }
    };
    find();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, i]);

  // Recalcular posición en scroll/resize.
  useEffect(() => {
    if (!active || !step.selector) return;
    const update = () => {
      const el = document.querySelector(step.selector!) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, i]);

  if (!mounted || !active) return null;

  const PAD = 8;
  const hole: Box | null = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[300]" style={{ pointerEvents: "auto" }} aria-modal>
      {hole ? (
        <div
          className="absolute rounded-xl ring-2 ring-primary/70 transition-all duration-300"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}

      <div
        className="absolute w-[300px] max-w-[calc(100vw-24px)] rounded-2xl border border-border bg-surface p-4 shadow-2xl transition-all duration-300"
        style={tooltipPos(hole)}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Sparkles size={15} />
          </span>
          <p className="text-sm font-semibold text-foreground leading-tight">{step.title}</p>
        </div>
        <p className="text-xs leading-relaxed text-muted">{step.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <button onClick={finish} className="text-xs text-muted transition-colors hover:text-foreground">
            Saltar
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">
              {i + 1}/{steps.length}
            </span>
            {i > 0 && (
              <button
                onClick={back}
                aria-label="Anterior"
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted transition-colors hover:text-foreground"
              >
                <ArrowLeft size={15} />
              </button>
            )}
            <button
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              {i >= steps.length - 1 ? "¡Listo!" : "Siguiente"}
              {i < steps.length - 1 && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
