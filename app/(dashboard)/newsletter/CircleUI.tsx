"use client";

import { useEffect, useState } from "react";
import { Flame, Sparkles, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Mirror } from "@/lib/circle-mirror";
import type { ScaffoldDose } from "@/lib/circle-scaffold";
import { PHASE_LABELS, scaffoldNotice, streakLabel, type Streak } from "@/lib/circle-scaffold";

/** Encabezado de una sección interna de Mi Círculo. */
export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-news text-3xl font-medium text-foreground sm:text-4xl">
        {title}
      </h2>
      <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted">
        {description}
      </p>
    </header>
  );
}

/** Estado vacío. En Mi Círculo "no hay nada" es una respuesta válida, no un error. */
export function QuietEmpty({ text }: { text: string }) {
  return (
    <div className="grid min-h-28 place-items-center px-4 py-6 text-center">
      <div>
        <UsersRound size={21} className="mx-auto text-muted-2" />
        <p className="mx-auto mt-2 max-w-[34ch] text-sm leading-relaxed text-muted">
          {text}
        </p>
      </div>
    </div>
  );
}

// ─── La capa fabricada ───────────────────────────────────────────────────────

export type Reward = {
  title: string;
  detail: string;
  /** Lo que quedó vivo por este acto, si aplica. */
  outcome?: string | null;
};

/**
 * El pico. Se muestra sólo después de un acto con fondo — convertir una
 * lectura, declarar una conversación, cerrar la ración, podar una fuente —,
 * nunca después de leer o de abrir algo. Esa distinción es todo el diseño.
 *
 * `full` viene de la dosis del andamio: los primeros meses ocupa la pantalla,
 * después se achica a una línea. La maquinaria se retira sola.
 */
export function RewardBurst({
  reward,
  full,
  onDone,
}: {
  reward: Reward | null;
  full: boolean;
  onDone: () => void;
}) {
  if (!reward) return null;
  // Montaje limpio por premio: entre uno y otro el estado vuelve a null, así
  // la animación de entrada arranca de cero sin sincronizar nada a mano.
  return <RewardCard key={reward.title} reward={reward} full={full} onDone={onDone} />;
}

function RewardCard({
  reward,
  full,
  onDone,
}: {
  reward: Reward;
  full: boolean;
  onDone: () => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Un frame para que la transición de entrada tenga de dónde salir.
    const enter = requestAnimationFrame(() => setShown(true));
    const leave = window.setTimeout(() => setShown(false), full ? 2600 : 1800);
    const done = window.setTimeout(onDone, full ? 3000 : 2200);
    return () => {
      cancelAnimationFrame(enter);
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, [reward, full, onDone]);

  if (!full) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 transition-all duration-300 ${
          shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <p className="rounded-full border border-success/25 bg-surface px-5 py-3 text-sm font-semibold text-foreground shadow-lg">
          {reward.title}
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-0 z-50 grid place-items-center px-6 transition-opacity duration-300 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" />
      <div
        className={`relative w-full max-w-sm rounded-2xl border border-success/25 bg-surface px-7 py-8 text-center shadow-2xl transition-transform duration-300 ${
          shown ? "scale-100" : "scale-95"
        }`}
      >
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/12 text-success">
          <Sparkles size={26} />
        </span>
        <p className="mt-4 font-news text-2xl leading-snug text-foreground">
          {reward.title}
        </p>
        <p className="mx-auto mt-2 max-w-[32ch] text-sm leading-relaxed text-muted">
          {reward.detail}
        </p>
        {reward.outcome && (
          <p className="mt-4 rounded-lg bg-surface-2/70 px-4 py-2 text-sm font-semibold text-foreground">
            {reward.outcome}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * La racha, en su versión honesta: semanas con al menos tres actos valiosos, no
 * días seguidos abriendo la app. Un día en el que la app dice "hoy no hay nada
 * que valga tu tiempo" no puede costarte nada.
 */
export function StreakChip({ streak }: { streak: Streak }) {
  const label = streakLabel(streak);
  if (!label && streak.thisWeek === 0) return null;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1.5 text-xs text-muted">
      <Flame size={14} className={label ? "text-primary" : "text-muted-2"} />
      {label ? (
        <span className="font-semibold text-foreground">{label}</span>
      ) : (
        <span>Semana empezada</span>
      )}
      {streak.missing > 0 && (
        <span>
          · {streak.missing} {streak.missing === 1 ? "acto" : "actos"} para
          asegurarla
        </span>
      )}
    </span>
  );
}

// ─── El espejo ───────────────────────────────────────────────────────────────

/**
 * Lo que juntaste. La otra mitad de la recompensa: acá no se fabrica nada, cada
 * línea es algo que la persona hizo. Cuando todavía no hizo nada, lo dice.
 */
export function MirrorPanel({
  mirror,
  title = "Lo que juntaste",
  compact = false,
}: {
  mirror: Mirror;
  title?: string;
  compact?: boolean;
}) {
  if (!mirror.isReady) {
    return (
      <div className="rounded-2xl border border-border bg-surface/35 px-5 py-6 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          {title}
        </p>
        <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted">
          {mirror.missing}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface/35 px-5 py-6 sm:px-7">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        {title}
      </p>
      {mirror.headline && (
        <p
          className={`mt-2 max-w-[40ch] font-news leading-snug text-foreground ${
            compact ? "text-xl" : "text-2xl sm:text-[1.75rem]"
          }`}
        >
          {mirror.headline}
        </p>
      )}
      <dl className="mt-6 grid gap-5 sm:grid-cols-2">
        {mirror.lines.map((line) => (
          <div key={line.key}>
            <dt className="text-xs uppercase tracking-[0.08em] text-muted">
              {line.label}
            </dt>
            <dd className="mt-1 flex flex-wrap items-baseline gap-2">
              {line.before && (
                <>
                  <span className="text-sm text-muted-2 line-through">
                    {line.before}
                  </span>
                  <span aria-hidden="true" className="text-muted-2">
                    →
                  </span>
                </>
              )}
              <span className="text-base font-semibold text-foreground">
                {line.after}
              </span>
            </dd>
            {line.detail && (
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {line.detail}
              </p>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── El contrato ─────────────────────────────────────────────────────────────

/**
 * Lo que la app declara sobre sí misma. Existe desde el minuto cero a
 * propósito: si el retiro del andamio se anuncia recién al final, se lee como
 * que la app te abandona. Anunciado desde el principio, es una promesa que se
 * cumple.
 */
export function ScaffoldContract({
  dose,
  onDismiss,
}: {
  dose: ScaffoldDose;
  onDismiss?: () => void;
}) {
  const notice = scaffoldNotice(dose);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary/[0.06] px-5 py-6 sm:px-7">
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Entendido"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <X size={16} />
        </button>
      )}
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        El trato · {PHASE_LABELS[dose.phase]}
      </p>
      <h2 className="mt-2 max-w-[30ch] font-news text-2xl leading-snug text-foreground">
        {notice.title}
      </h2>
      <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted">
        {notice.body}
      </p>
      {onDismiss && (
        <Button variant="secondary" onClick={onDismiss} className="mt-5">
          Entendido
        </Button>
      )}
    </section>
  );
}
