"use client";

import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { MessageCircle, Tag, BarChart3 } from "lucide-react";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/* ── Escenas (visual de la derecha) ── */

function SceneCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-md rounded-[2rem] border border-border bg-surface/70 p-6 shadow-2xl backdrop-blur">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/25 via-secondary/15 to-transparent blur-2xl" />
      {children}
    </div>
  );
}

function Scene1() {
  return (
    <SceneCard>
      <div className="overflow-hidden rounded-2xl bg-[#0b141a]">
        <div className="flex items-center gap-2.5 bg-emerald-600 px-4 py-2.5 text-white">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-sm font-semibold">c</span>
          <p className="text-sm font-semibold">control.io</p>
        </div>
        <div className="space-y-2 px-3 py-4">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-emerald-700 px-3 py-2 text-[13px] text-white">
              gasté 5 lucas en el súper 🛒
            </div>
          </div>
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-br-sm bg-emerald-700 px-3 py-2 text-[13px] text-white">
              🎤 audio · 0:07
            </div>
          </div>
        </div>
      </div>
    </SceneCard>
  );
}

function Scene2() {
  return (
    <SceneCard>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Se registró solo</p>
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-danger/10 text-base">🛒</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Supermercado</p>
            <p className="text-xs text-muted">Hoy · Mercado Pago</p>
          </div>
          <p className="font-mono text-sm font-bold text-danger">-$5.000</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">🏷️ Comida</span>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">🏦 Mercado Pago</span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">categorizado por IA</span>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2.5">
          <span className="text-xs text-muted">Saldo Mercado Pago</span>
          <span className="font-mono text-sm font-bold text-foreground">$401.625</span>
        </div>
      </div>
    </SceneCard>
  );
}

function Scene3() {
  const bars = [60, 80, 70, 90, 75, 100];
  return (
    <SceneCard>
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Ingresos", v: "$400.000", c: "text-success" },
          { l: "Gastos", v: "$88.390", c: "text-danger" },
          { l: "Ahorro", v: "24%", c: "text-primary" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-border bg-background/50 p-3">
            <p className="text-[10px] text-muted">{k.l}</p>
            <p className={`mt-1 font-mono text-sm font-bold ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-28 items-end gap-2 rounded-xl border border-border bg-background/50 p-3">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary" style={{ height: `${h}%` }} />
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">Tu mes, claro de un vistazo.</p>
    </SceneCard>
  );
}

const STEPS = [
  { n: "01", icon: MessageCircle, title: "Lo decís y queda cargado", body: "Por WhatsApp: un texto, un audio o la foto de un ticket. Sin abrir la app, sin planillas.", scene: <Scene1 /> },
  { n: "02", icon: Tag, title: "Se ordena y categoriza solo", body: "La IA lo clasifica, lo asocia a la cuenta correcta y actualiza tu saldo al instante.", scene: <Scene2 /> },
  { n: "03", icon: BarChart3, title: "Y entendés tu mes", body: "Ingresos, gastos, ahorro y tendencias, claros de un vistazo. Sabés a dónde va cada peso.", scene: <Scene3 /> },
];

export function Scrollytelling() {
  const [active, setActive] = useState(0);

  return (
    <section className="mx-auto max-w-7xl px-5 sm:px-8">
      <div className="py-16 text-center sm:py-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs uppercase tracking-widest text-muted backdrop-blur">
          Cómo funciona
        </span>
        <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          De un mensaje a <span className="text-primary">tu mes entendido.</span>
        </h2>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Pasos (scroll) */}
        <div>
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              onViewportEnter={() => setActive(i)}
              viewport={{ margin: "-50% 0px -50% 0px" }}
              className="flex min-h-[70vh] flex-col justify-center"
            >
              <div className="flex items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-xl border transition-colors ${active === i ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-surface/50 text-muted"}`}>
                  <s.icon className="h-5 w-5" />
                </span>
                <span className={`font-mono text-3xl font-bold transition-colors ${active === i ? "text-primary" : "text-muted/30"}`}>{s.n}</span>
              </div>
              <h3 className={`mt-5 text-2xl font-bold tracking-tight transition-colors sm:text-3xl ${active === i ? "text-foreground" : "text-muted/40"}`}>
                {s.title}
              </h3>
              <p className={`mt-3 max-w-md text-base leading-relaxed transition-colors ${active === i ? "text-muted" : "text-muted/30"}`}>
                {s.body}
              </p>
              {/* Visual inline en mobile */}
              <div className="mt-7 lg:hidden">{s.scene}</div>
            </motion.div>
          ))}
        </div>

        {/* Visual sticky (desktop) */}
        <div className="hidden lg:block">
          <div className="sticky top-0 flex h-screen items-center">
            <div className="relative w-full">
              {STEPS.map((s, i) => (
                <motion.div
                  key={s.n}
                  className="absolute inset-0 flex items-center"
                  initial={false}
                  animate={{ opacity: active === i ? 1 : 0, scale: active === i ? 1 : 0.95, y: active === i ? 0 : 16 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  style={{ pointerEvents: active === i ? "auto" : "none" }}
                >
                  {s.scene}
                </motion.div>
              ))}
              {/* Spacer invisible para dar alto al contenedor absoluto */}
              <div className="invisible">{STEPS[2].scene}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
