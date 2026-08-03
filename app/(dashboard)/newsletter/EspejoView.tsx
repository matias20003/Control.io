"use client";

import { useMemo, useRef, useTransition } from "react";
import {
  ArrowRight,
  Download,
  Heart,
  Loader2,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  decideInventoryItemAction,
  importInventoryAction,
} from "@/app/actions/circle-system";
import type {
  CircleBaseline,
  SerializedInventoryItem,
} from "@/lib/db/circle-migration";
import type { CircleContact } from "@/lib/db/circle";
import type { SerializedBriefSource } from "@/lib/brief/types";
import { inventoryProgress } from "@/lib/circle-inventory";
import { SectionHeading, type Reward } from "./CircleUI";

/**
 * El Espejo · el día 1.
 *
 * Antes se llamaba "etapa 0 de La Mudanza" y estaba enterrado en un proceso
 * opcional. Es al revés: es el momento más persuasivo de todo el producto y la
 * única forma de tener línea de base.
 *
 * Hace dos trabajos que ningún otro lugar puede hacer:
 *
 *   1. Le muestra a la persona algo sobre su propia vida que nunca vio — sigue
 *      a 412 cuentas y las que de verdad le importan son once. No es una
 *      promesa de marketing: es evidencia, y no cuesta nada porque es verdad.
 *   2. Congela el "412". Ese número es imposible de reconstruir después: sin
 *      él, el espejo del mes 6 queda en números absolutos, que no prueban un
 *      cambio.
 *
 * El filtro es de compromiso, nunca de confusión: clasificar cuatrocientas
 * cuentas es exigente a propósito, pero cada paso tiene que estar clarísimo.
 */
export function EspejoView({
  inventory,
  baseline,
  uploadedAt,
  onInventoryChange,
  onContactAdded,
  onSourceAdded,
  onReward,
  onContinue,
}: {
  inventory: SerializedInventoryItem[];
  baseline: CircleBaseline | null;
  uploadedAt: string | null;
  onInventoryChange: (next: SerializedInventoryItem[]) => void;
  onContactAdded: (contact: CircleContact) => void;
  onSourceAdded: (source: SerializedBriefSource) => void;
  onReward: (reward: Reward) => void;
  onContinue: () => void;
}) {
  const progreso = useMemo(() => inventoryProgress(inventory), [inventory]);
  const pendientes = inventory.filter((item) => item.decision === "PENDING");
  const terminó = inventory.length > 0 && pendientes.length === 0;

  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="El Espejo"
        title="Mirá a quién estás siguiendo"
        description="Antes de sacar nada, ver qué hay. Es tu propia lista de seguidos, pedida por vos: no hay scraping ni se viola ningún término."
      />

      {baseline && <BaselineCard baseline={baseline} progress={progreso.percent} />}

      {inventory.length === 0 && <ImportCard uploadedAt={uploadedAt} />}

      {inventory.length > 0 && !terminó && (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface/45">
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-news text-xl text-foreground">
                Clasificá cada cuenta
              </h3>
              <p className="text-xs text-muted">
                {progreso.classified} de {progreso.total} · {progreso.percent}%
              </p>
            </div>
            <p className="mt-1 max-w-[60ch] text-xs leading-relaxed text-muted">
              Este acto es la mitad del valor de la sección. Nadie lo hizo nunca
              a conciencia.
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${progreso.percent}%` }}
              />
            </div>
          </div>

          {pendientes.slice(0, 40).map((item) => (
            <InventoryRow
              key={item.id}
              item={item}
              restantes={pendientes.length}
              onDecided={(updated) =>
                onInventoryChange(
                  inventory.map((row) => (row.id === updated.id ? updated : row)),
                )
              }
              onContactAdded={onContactAdded}
              onSourceAdded={onSourceAdded}
              onReward={onReward}
            />
          ))}

          {pendientes.length > 40 && (
            <p className="border-t border-border px-5 py-3 text-xs text-muted">
              Mostrando 40 de {pendientes.length} pendientes. Clasificá estas y
              aparecen las que siguen.
            </p>
          )}
        </div>
      )}

      {terminó && (
        <div className="mt-6 rounded-xl border border-success/25 bg-success/[0.06] px-5 py-6 sm:px-7">
          <h3 className="font-news text-2xl text-foreground">
            Ya sabés a quién seguías
          </h3>
          <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-muted">
            Las personas y los referentes que marcaste ya están adentro. Lo que
            marcaste como ruido no va a ningún lado — y ese número queda
            guardado para poder mostrarte, dentro de unos meses, de dónde saliste.
          </p>
          <Button onClick={onContinue} className="mt-5">
            Seguir
            <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {inventory.length > 0 && <ImportCard uploadedAt={uploadedAt} secondary />}
    </section>
  );
}

/** El número del día 1, en grande. Es la evidencia, no un adorno. */
function BaselineCard({
  baseline,
  progress,
}: {
  baseline: CircleBaseline;
  progress: number;
}) {
  const clasificadas = baseline.people + baseline.references + baseline.noise;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface/45 px-5 py-6 sm:px-7">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
        Cuando abriste el espejo
      </p>
      <p className="mt-2 font-news text-4xl text-foreground sm:text-5xl">
        {baseline.followedAtStart}
      </p>
      <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-muted">
        cuentas seguidas.{" "}
        {clasificadas > 0
          ? "Así se reparten las que ya clasificaste."
          : "Todavía no clasificaste ninguna."}
      </p>

      {clasificadas > 0 && (
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <Reparto label="Personas que querés" value={baseline.people} tone="primary" />
          <Reparto label="Referentes" value={baseline.references} tone="primary" />
          <Reparto label="Ruido" value={baseline.noise} tone="muted" />
        </dl>
      )}

      {progress > 0 && progress < 100 && (
        <p className="mt-4 text-xs text-muted">
          Te queda {100 - progress}% por clasificar.
        </p>
      )}
    </div>
  );
}

function Reparto({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "muted";
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd
        className={`mt-1 font-news text-2xl ${
          tone === "primary" ? "text-primary" : "text-muted-2"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ImportCard({
  uploadedAt,
  secondary = false,
}: {
  uploadedAt: string | null;
  secondary?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, startImporting] = useTransition();

  const subir = (file: File) => {
    startImporting(async () => {
      const raw = await file.text();
      const result = await importInventoryAction(raw);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.imported} cuentas nuevas${result.alreadyThere ? `, ${result.alreadyThere} ya estaban` : ""}.`,
      );
      // La lista completa la trae el server al revalidar; recargamos la vista.
      window.location.reload();
    });
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".json,application/json"
      className="sr-only"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) subir(file);
        event.target.value = "";
      }}
    />
  );

  if (secondary) {
    return (
      <details className="mt-6 text-sm text-muted">
        <summary className="min-h-11 cursor-pointer py-3 hover:text-foreground">
          Subir un export más nuevo
        </summary>
        {input}
        <Button
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={isImporting}
        >
          {isImporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          Subir following.json
        </Button>
        {uploadedAt && (
          <p className="mt-2 text-xs text-muted">
            Último archivo: {new Date(uploadedAt).toLocaleDateString("es-AR")}
          </p>
        )}
      </details>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface/60 p-5 sm:p-6">
      <p className="text-sm font-semibold text-foreground">
        Traé tu lista de seguidos
      </p>
      <ol className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
        <li>
          <span className="font-semibold text-foreground">1.</span> En Instagram:
          Centro de cuentas → Tu información y permisos →{" "}
          <span className="font-semibold text-foreground">
            Descargar tu información
          </span>
          . Pedí el formato <span className="font-semibold">JSON</span>.
        </li>
        <li>
          <span className="font-semibold text-foreground">2.</span> Te llega por
          mail. Puede tardar de unas horas a un día.
        </li>
        <li>
          <span className="font-semibold text-foreground">3.</span> Descomprimí y
          buscá{" "}
          <code className="rounded bg-surface-3 px-1 py-0.5 text-[11px]">
            following.json
          </code>
          . Subilo acá.
        </li>
      </ol>
      <p className="mt-3 max-w-[60ch] text-xs leading-relaxed text-muted">
        Son tus propios datos, pedidos por vos. Control.io no entra a tu cuenta
        ni lee perfiles ajenos.
      </p>

      {input}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => inputRef.current?.click()} disabled={isImporting}>
          {isImporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          Subir following.json
        </Button>
        <a
          href="https://accountscenter.instagram.com/info_and_permissions/dyi/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-surface-2"
        >
          <Download size={15} />
          Pedirle el export a Instagram
        </a>
      </div>
      {uploadedAt && (
        <p className="mt-3 text-xs text-muted">
          Último archivo subido:{" "}
          {new Date(uploadedAt).toLocaleDateString("es-AR")}
        </p>
      )}
    </div>
  );
}

function InventoryRow({
  item,
  restantes,
  onDecided,
  onContactAdded,
  onSourceAdded,
  onReward,
}: {
  item: SerializedInventoryItem;
  restantes: number;
  onDecided: (updated: SerializedInventoryItem) => void;
  onContactAdded: (contact: CircleContact) => void;
  onSourceAdded: (source: SerializedBriefSource) => void;
  onReward: (reward: Reward) => void;
}) {
  const [isPending, startPending] = useTransition();

  const decidir = (decision: "PERSON" | "REFERENCE" | "NOISE") => {
    startPending(async () => {
      const result = await decideInventoryItemAction(item.id, decision);
      if (result.error || !result.inventoryItem) {
        toast.error(result.error ?? "No pudimos guardar esa decisión.");
        return;
      }
      onDecided(result.inventoryItem);
      if (result.contact) onContactAdded(result.contact);
      if (result.source) onSourceAdded(result.source);

      // La última decisión del inventario sí se celebra: terminar de mirarse al
      // espejo es un acto con fondo. Las intermedias no, para no volver ruido
      // una tarea de cuatrocientos pasos.
      if (restantes === 1) {
        onReward({
          title: "Terminaste de mirarte",
          detail:
            "Clasificaste toda tu lista. Ese número queda guardado para poder mostrarte de dónde saliste.",
        });
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          @{item.handle}
        </p>
        {item.fullName && (
          <p className="truncate text-xs text-muted">{item.fullName}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <DecisionButton
          icon={Heart}
          label="Persona"
          onClick={() => decidir("PERSON")}
          disabled={isPending}
        />
        <DecisionButton
          icon={UserRound}
          label="Referente"
          onClick={() => decidir("REFERENCE")}
          disabled={isPending}
        />
        <DecisionButton
          icon={Trash2}
          label="Ruido"
          onClick={() => decidir("NOISE")}
          disabled={isPending}
          quiet
        />
      </div>
    </div>
  );
}

function DecisionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  quiet = false,
}: {
  icon: typeof Heart;
  label: string;
  onClick: () => void;
  disabled: boolean;
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
        quiet
          ? "border-border text-muted hover:bg-surface-3"
          : "border-primary/40 text-primary hover:bg-primary/10"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
