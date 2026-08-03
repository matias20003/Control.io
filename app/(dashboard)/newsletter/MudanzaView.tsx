"use client";

import { useTransition } from "react";
import { ArrowRight, Check, CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  recordReinstallAction,
  setMigrationStageAction,
} from "@/app/actions/circle-system";
import type { SerializedMigration } from "@/lib/db/circle-migration";
import {
  MUDANZA_STAGES,
  STAGE_DESCRIPTIONS,
  STAGE_LABELS,
  type CutChecklist,
  type MigrationStage,
} from "@/lib/circle-inventory";
import { SectionHeading } from "./CircleUI";

export function MudanzaView({
  migration,
  checklist,
  onMigrationChange,
  onOpenEspejo,
}: {
  migration: SerializedMigration;
  checklist: CutChecklist;
  onMigrationChange: (next: SerializedMigration) => void;
  onOpenEspejo: () => void;
}) {
  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="La Mudanza"
        title="De Instagram a acá"
        description="Un hábito no se saca, se reemplaza. Cada etapa sustituye antes de quitar: cortar primero falla siempre. Desinstalar es una decisión tuya, no un requisito de la sección."
      />

      <StageBar stage={migration.stage} onMigrationChange={onMigrationChange} />

      {migration.stage === "INVENTORY" && (
        <InventoryMoved onOpenEspejo={onOpenEspejo} />
      )}
      {migration.stage === "REPLACE" && <ReplaceStage checklist={checklist} />}
      {migration.stage === "COEXIST" && <CoexistStage days={migration.coexistDays} />}
      {migration.stage === "CUT" && (
        <CutStage
          checklist={checklist}
          migration={migration}
          onMigrationChange={onMigrationChange}
        />
      )}
      {migration.stage === "AFTER" && (
        <AfterStage migration={migration} onMigrationChange={onMigrationChange} />
      )}
    </section>
  );
}

function StageBar({
  stage,
  onMigrationChange,
}: {
  stage: MigrationStage;
  onMigrationChange: (next: SerializedMigration) => void;
}) {
  const [isPending, startPending] = useTransition();
  // Una mudanza que arrancó antes de que el inventario se mudara al Espejo
  // puede estar todavía en INVENTORY: se muestra como "antes de empezar".
  const actualIndex = MUDANZA_STAGES.indexOf(stage);

  const go = (next: MigrationStage) => {
    startPending(async () => {
      const result = await setMigrationStageAction(next);
      if (result.error || !result.migration) {
        toast.error(result.error ?? "No pudimos cambiar de etapa.");
        return;
      }
      onMigrationChange(result.migration);
    });
  };

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface/45">
      <div className="grid md:grid-cols-4">
        {MUDANZA_STAGES.map((item, index) => {
          const hecha = index < actualIndex;
          const actual = index === actualIndex;
          return (
            <button
              key={item}
              type="button"
              onClick={() => go(item)}
              disabled={isPending}
              className={`flex min-h-20 flex-col justify-center gap-1 border-b border-border px-4 py-3 text-left transition-colors md:border-b-0 md:border-r md:last:border-r-0 ${
                actual ? "bg-primary/[0.08]" : "hover:bg-surface-2"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                    hecha
                      ? "bg-success-dim text-success"
                      : actual
                        ? "bg-primary text-background"
                        : "bg-surface-3 text-muted"
                  }`}
                >
                  {hecha ? <Check size={12} /> : index + 1}
                </span>
                <span
                  className={`text-sm font-semibold ${actual ? "text-primary" : "text-foreground"}`}
                >
                  {STAGE_LABELS[item]}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="border-t border-border px-5 py-3 text-xs leading-relaxed text-muted">
        {STAGE_DESCRIPTIONS[stage]}
      </p>
    </div>
  );
}

// ─── Antes de empezar ───────────────────────────────────────────────────────

/**
 * El inventario se mudó al Espejo. Acá queda sólo el puente para las mudanzas
 * que ya estaban arrancadas en la etapa vieja.
 */
function InventoryMoved({ onOpenEspejo }: { onOpenEspejo: () => void }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-surface/60 p-5 sm:p-6">
      <h3 className="font-news text-xl text-foreground">
        El inventario ahora es lo primero
      </h3>
      <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted">
        Mirar a quién seguís dejó de ser el paso 0 de este proceso: es la puerta
        de entrada de la sección, porque es lo que te muestra de dónde partís.
        Terminá ahí y volvé cuando quieras empezar a mudarte.
      </p>
      <Button onClick={onOpenEspejo} className="mt-5">
        Ir a El Espejo
        <ArrowRight size={16} />
      </Button>
    </div>
  );
}

// ─── Etapa 1 · El reemplazo ─────────────────────────────────────────────────

function ReplaceStage({ checklist }: { checklist: CutChecklist }) {
  const personas =
    checklist.peopleTotal === 0
      ? 0
      : Math.round((checklist.peopleWithPhone / checklist.peopleTotal) * 100);
  const referentes =
    checklist.referencesTotal === 0
      ? 100
      : Math.round((checklist.referencesWithChannel / checklist.referencesTotal) * 100);

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <CoverageCard
        title="Personas con teléfono"
        done={checklist.peopleWithPhone}
        total={checklist.peopleTotal}
        percent={personas}
        hint="Si desinstalás sin el teléfono, perdés el contacto."
      />
      <CoverageCard
        title="Referentes con canal propio"
        done={checklist.referencesWithChannel}
        total={checklist.referencesTotal}
        percent={referentes}
        hint="Los que no tienen canal son los únicos que van a necesitar el puente."
      />
    </div>
  );
}

function CoverageCard({
  title,
  done,
  total,
  percent,
  hint,
}: {
  title: string;
  done: number;
  total: number;
  percent: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted">
          {done} de {total}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">{hint}</p>
    </div>
  );
}

// ─── Etapa 2 · La convivencia ───────────────────────────────────────────────

// Los días los cuenta el server: leer el reloj durante el render rompe la
// pureza y hace que cliente y servidor puedan discrepar cruzando la medianoche.
function CoexistStage({ days }: { days: number | null }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-surface/60 p-5">
      <p className="font-news text-2xl text-foreground">
        {!days ? "Arrancó la convivencia" : `Día ${days} de la convivencia`}
      </p>
      <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted">
        Instagram sigue instalado. No hay nada que prohibir acá: es una prueba.
        Durante estas semanas el gancho de Mi Círculo no es el contenido —en
        contenido Instagram gana siempre— sino que haya una persona esperándote y
        que la edición sea corta y termine.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Cuando dos o tres semanas hayan pasado y abrir Instagram ya no te dé
        nada que no tengas acá, pasá al corte.
      </p>
    </div>
  );
}

// ─── Etapa 3 · El corte ─────────────────────────────────────────────────────

function CutStage({
  checklist,
  migration,
  onMigrationChange,
}: {
  checklist: CutChecklist;
  migration: SerializedMigration;
  onMigrationChange: (next: SerializedMigration) => void;
}) {
  const [isPending, startPending] = useTransition();

  const confirmar = () => {
    startPending(async () => {
      const result = await setMigrationStageAction("AFTER");
      if (result.error || !result.migration) {
        toast.error(result.error ?? "No pudimos anotarlo.");
        return;
      }
      onMigrationChange(result.migration);
      toast.success("Listo. Nos vemos del otro lado.");
    });
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-xl border border-border bg-surface/60 p-5">
        <p className="text-sm font-semibold text-foreground">Antes de desinstalar</p>

        {checklist.blockers.length === 0 ? (
          <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-success">
            <Check size={16} className="mt-0.5 shrink-0" />
            Tenés el reemplazo cubierto. Podés cortar sin quedarte sin nada.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {checklist.blockers.map((blocker) => (
              <li
                key={blocker}
                className="flex items-start gap-2 text-sm leading-relaxed text-warning"
              >
                <CircleAlert size={16} className="mt-0.5 shrink-0" />
                {blocker}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Esto informa, no prohíbe. Podés cortar igual — pero cortar antes de
          tener el reemplazo listo es lo que hace fracasar el intento.
        </p>

        <Button
          onClick={confirmar}
          disabled={isPending}
          className="mt-4"
          variant={checklist.ready ? "default" : "secondary"}
        >
          {isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ArrowRight size={16} />
          )}
          Ya la desinstalé
        </Button>
      </div>

      {migration.uninstalledAt && (
        <p className="text-xs text-muted">
          Marcaste el corte el{" "}
          {new Date(migration.uninstalledAt).toLocaleDateString("es-AR")}.
        </p>
      )}
    </div>
  );
}

// ─── Etapa 4 · La vida después ──────────────────────────────────────────────

function AfterStage({
  migration,
  onMigrationChange,
}: {
  migration: SerializedMigration;
  onMigrationChange: (next: SerializedMigration) => void;
}) {
  const [isPending, startPending] = useTransition();

  const volvi = () => {
    startPending(async () => {
      const result = await recordReinstallAction();
      if (result.error || !result.migration) {
        toast.error(result.error ?? "No pudimos anotarlo.");
        return;
      }
      onMigrationChange(result.migration);
      toast.success("Anotado. Volvemos a la convivencia, sin drama.");
    });
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-xl border border-border bg-surface/60 p-5">
        {migration.daysWithout !== null ? (
          <>
            <p className="font-news text-3xl text-foreground">
              {migration.daysWithout}{" "}
              {migration.daysWithout === 1 ? "día" : "días"}
            </p>
            <p className="mt-1 text-sm text-muted">sin Instagram.</p>
          </>
        ) : (
          <p className="font-news text-2xl text-foreground">La vida después</p>
        )}
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-muted">
          Los días no son el logro: son la consecuencia. Lo que importa es lo que
          quedó en su lugar — conversaciones que ocurrieron de verdad, piezas que
          se convirtieron en algo, tiempo que volvió a ser tuyo.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface/45 px-5 py-4">
        <p className="text-sm text-foreground">¿Volviste a instalarla?</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          No pasa nada y no se pierde nada. Se anota, volvemos a la convivencia y
          seguís. Un producto que castiga la recaída se desinstala él.
        </p>
        <Button variant="secondary" onClick={volvi} disabled={isPending} className="mt-3">
          {isPending ? <Loader2 size={15} className="animate-spin" /> : null}
          La volví a instalar
        </Button>
      </div>
    </div>
  );
}
