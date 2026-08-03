"use client";

import { useTransition } from "react";
import { CheckCircle2, Repeat, Scissors, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteBriefSourceAction } from "@/app/actions/newsletter";
import type { HarvestReport } from "@/lib/db/circle-harvest";
import type { Mirror } from "@/lib/circle-mirror";
import { SectionHeading, QuietEmpty, MirrorPanel, type Reward } from "./CircleUI";

export function CosechaView({
  report,
  mirror,
  onSourcePruned,
  onReward,
}: {
  report: HarvestReport;
  mirror: Mirror;
  onSourcePruned: (sourceId: string) => void;
  onReward?: (reward: Reward) => void;
}) {
  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="La Cosecha"
        title="Qué dejó lo que leíste"
        description="Consumir sin convertir es entretenimiento. Acá no se mide cuánto tiempo pasaste: se mide qué salió de eso."
      />

      {/* El acumulado de siempre va primero. El informe del mes decide qué
          fuente echás; esto prueba un cambio, y un cambio no cabe en un mes. */}
      <div className="mt-6">
        <MirrorPanel mirror={mirror} />
      </div>

      <div className="mt-6 grid overflow-hidden rounded-xl border border-border bg-surface/60 sm:grid-cols-3">
        <Metric
          label="Piezas abiertas"
          value={String(report.opened)}
          detail="Lo que consumiste este mes"
        />
        <Metric
          label="Se convirtieron en algo"
          value={String(report.converted)}
          detail={`${report.byOutcome.task} tareas · ${report.byOutcome.habit} hábitos · ${report.byOutcome.note} notas`}
        />
        <Metric
          label="Ratio de conversión"
          value={`${report.conversionRate}%`}
          detail="El número que reemplaza al tiempo de pantalla"
          last
        />
      </div>

      {report.toPrune.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-warning/30 bg-surface/45">
          <div className="border-b border-border bg-warning-dim px-5 py-4">
            <h3 className="flex items-center gap-2 font-news text-xl text-warning">
              <Scissors size={18} />
              La poda
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-warning">
              Estas fuentes hace 60 días o más que no te dan nada. Las fuentes se
              ganan el lugar: mientras todos los algoritmos expanden tu feed,
              este lo achica.
            </p>
          </div>
          {report.toPrune.map((source) => (
            <PruneRow
              key={source.sourceId}
              source={source}
              onPruned={onSourcePruned}
              onReward={onReward}
            />
          ))}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface/45">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-news text-xl text-foreground">Qué te dio cada fuente</h3>
          <p className="mt-1 text-xs text-muted">Ordenadas por lo que produjeron</p>
        </div>
        {report.sources.map((source) => (
          <div
            key={source.sourceId}
            className="flex min-h-16 items-center gap-3 border-b border-border px-5 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{source.name}</p>
              <p className="mt-0.5 text-xs text-muted">
                {source.conversions === 0
                  ? source.daysSinceLastConversion === null
                    ? "Todavía no produjo nada"
                    : "Sin conversiones"
                  : `Última conversión hace ${source.daysSinceLastConversion} días`}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                source.conversions > 0
                  ? "bg-success-dim text-success"
                  : "bg-surface-3 text-muted"
              }`}
            >
              {source.conversions}
            </span>
          </div>
        ))}
        {report.sources.length === 0 && (
          <QuietEmpty text="Todavía no hay fuentes para medir." />
        )}
      </div>
    </section>
  );
}

/**
 * Podar es un acto con fondo y se celebra como tal. Es la recompensa más rara
 * de todo el sistema: en cualquier otra app achicar tu feed sería una pérdida.
 */
function PruneRow({
  source,
  onPruned,
  onReward,
}: {
  source: HarvestReport["toPrune"][number];
  onPruned: (sourceId: string) => void;
  onReward?: (reward: Reward) => void;
}) {
  const [isPending, startPending] = useTransition();

  const podar = () => {
    startPending(async () => {
      const result = await deleteBriefSourceAction(source.sourceId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onPruned(source.sourceId);
      onReward?.({
        title: "Una fuente menos",
        detail: `${source.name} no te dio nada en ${source.daysSinceLastConversion} días. Tu lista se achicó, que es exactamente lo que tiene que pasar.`,
      });
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{source.name}</p>
        <p className="mt-0.5 text-xs text-muted">
          {source.daysSinceLastConversion} días sin darte nada
        </p>
      </div>
      <Button variant="secondary" onClick={podar} disabled={isPending}>
        <Trash2 size={15} />
        Sacarla
      </Button>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  last = false,
}: {
  label: string;
  value: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <div
      className={`px-5 py-5 ${last ? "" : "border-b border-border sm:border-b-0 sm:border-r"}`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="mt-1 font-news text-3xl text-foreground">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
    </div>
  );
}

/**
 * Los tres destinos de una pieza. Se muestra debajo de cada contenido de la
 * edición: si no se puede convertir en un tap, no se convierte nunca.
 */
export function HarvestButtons({
  onHarvest,
  busy,
  done,
}: {
  onHarvest: (outcome: "TASK" | "HABIT" | "NOTE") => void;
  busy: boolean;
  done: boolean;
}) {
  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
        <CheckCircle2 size={14} />
        Ya lo convertiste
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <HarvestButton
        icon={CheckCircle2}
        label="Tarea"
        onClick={() => onHarvest("TASK")}
        disabled={busy}
      />
      <HarvestButton
        icon={Repeat}
        label="Hábito"
        onClick={() => onHarvest("HABIT")}
        disabled={busy}
      />
      <HarvestButton
        icon={StickyNote}
        label="Guardar"
        onClick={() => onHarvest("NOTE")}
        disabled={busy}
      />
    </div>
  );
}

function HarvestButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof CheckCircle2;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-muted transition-colors hover:border-primary/40 hover:bg-primary/8 hover:text-primary disabled:opacity-50"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
