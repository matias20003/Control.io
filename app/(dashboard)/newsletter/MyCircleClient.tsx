"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  ExternalLink,
  Eye,
  Camera as Instagram,
  Loader2,
  Newspaper,
  PackageOpen,
  Plus,
  Radar,
  RefreshCw,
  Rss,
  Settings2,
  ShieldCheck,
  Sprout,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  generateNewsletterNowAction,
  markNewsletterReadAction,
  recordBriefItemOpenedAction,
  reopenBriefEditionAction,
  saveNewsletterConfigAction,
} from "@/app/actions/newsletter";
import type { SerializedConfig, SerializedEdition } from "@/lib/db/newsletter";
import type {
  SerializedBriefItem,
  SerializedBriefSource,
  SerializedDiscoveryCandidate,
} from "@/lib/brief/types";
import type { CircleContact } from "@/lib/db/circle";
import type { SerializedChannel } from "@/lib/db/channels";
import type { SerializedFront } from "@/lib/db/circle-north";
import type { HarvestReport, LifetimeHarvest } from "@/lib/db/circle-harvest";
import type {
  CircleBaseline,
  SerializedInventoryItem,
  SerializedMigration,
} from "@/lib/db/circle-migration";
import { cutChecklist } from "@/lib/circle-inventory";
import { rankDueContacts, sinceLabel } from "@/lib/circle-cadence";
import { frontForTopic } from "@/lib/circle-north";
import { buildMirror, type Mirror } from "@/lib/circle-mirror";
import { weeklyStreak, type ScaffoldDose, type Streak } from "@/lib/circle-scaffold";
import { harvestItemAction } from "@/app/actions/circle-system";
import { CercanosView } from "./CercanosView";
import { CosechaView, HarvestButtons } from "./CosechaView";
import { ReferentesView } from "./ReferentesView";
import { NorteView } from "./NorteView";
import { MudanzaView } from "./MudanzaView";
import { EspejoView } from "./EspejoView";
import {
  SectionHeading,
  QuietEmpty,
  MirrorPanel,
  RewardBurst,
  ScaffoldContract,
  StreakChip,
  type Reward,
} from "./CircleUI";

export type CircleSection =
  | "home"
  | "cercanos"
  | "referentes"
  | "espejo"
  | "news"
  | "radar"
  | "norte"
  | "cosecha"
  | "mudanza"
  | "settings";

/**
 * Cada sección tiene URL propia. La pantalla sigue siendo una sola y la sección
 * vive en el estado, pero la URL la acompaña: sin eso, ocho pantallas enteras
 * (los vínculos que tocan, la cosecha, el espejo) eran inalcanzables desde el
 * menú, no se podían compartir ni volver con el botón de atrás, y nadie sabía
 * que existían.
 */
export const CIRCLE_SECTION_PATHS: Record<CircleSection, string> = {
  home: "/circulo",
  cercanos: "/circulo/cercanos",
  referentes: "/circulo/referentes",
  norte: "/circulo/norte",
  cosecha: "/circulo/cosecha",
  espejo: "/circulo/espejo",
  mudanza: "/circulo/mudanza",
  radar: "/circulo/radar",
  news: "/circulo/noticias",
  settings: "/circulo/ajustes",
};


type Props = {
  initialConfig: SerializedConfig;
  initialEditions: SerializedEdition[];
  initialSources: SerializedBriefSource[];
  initialRadar: SerializedDiscoveryCandidate[];
  initialContacts: CircleContact[];
  initialChannels: Record<string, SerializedChannel[]>;
  initialFronts: SerializedFront[];
  initialMigration: SerializedMigration;
  initialInventory: SerializedInventoryItem[];
  initialHarvest: HarvestReport;
  initialHarvestedUrls: string[];
  northNeedsReview: boolean;
  showCercanos: boolean;
  showSystem: boolean;
  /** El día 1: a cuántas cuentas seguía cuando abrió el espejo. */
  baseline: CircleBaseline | null;
  /** El acumulado de siempre, para el espejo. */
  lifetime: LifetimeHarvest;
  conversations: number;
  conversationsWithMemory: number;
  /** Fechas de actos valiosos (conversiones y conversaciones), para la racha. */
  actDates: string[];
  /** Con qué sección abre. La define la ruta. */
  initialSection?: CircleSection;
  /** Si la URL debe seguir a la sección. Sólo en las rutas /circulo. */
  syncUrl?: boolean;
  /** Cuánta maquinaria fabricada corresponde hoy. */
  dose: ScaffoldDose;
};

function metadataText(
  metadata: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "sin fecha";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "sin fecha";
  const minutes = Math.max(0, Math.floor((Date.now() - parsed) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

function formatWindow(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00 a ${String(
    (hour + 1) % 24,
  ).padStart(2, "0")}:00`;
}

function windowState(hours: number[]) {
  const now = new Date();
  const current = now.getHours();
  const sorted = [...hours].sort((a, b) => a - b);
  const active = sorted.find((hour) => current === hour);
  if (active !== undefined) {
    return {
      active: true,
      hour: active,
      label: `Ahora, ${formatWindow(active)}`,
    };
  }
  const next = sorted.find((hour) => hour > current);
  const hour = next ?? sorted[0] ?? 8;
  return {
    active: false,
    hour,
    label: `${next === undefined ? "Mañana" : "Hoy"}, ${formatWindow(hour)}`,
  };
}

function topicGroups(items: SerializedBriefItem[]) {
  const groups = new Map<string, SerializedBriefItem[]>();
  for (const item of items.filter((entry) => entry.kind === "NEWS")) {
    const topic = item.topic || "Actualidad";
    const current = groups.get(topic) ?? [];
    if (current.length < 3) current.push(item);
    groups.set(topic, current);
  }
  return [...groups.entries()];
}


export function MyCircleClient({
  initialConfig,
  initialEditions,
  initialSources,
  initialRadar,
  initialContacts,
  initialChannels,
  initialFronts,
  initialMigration,
  initialInventory,
  initialHarvest,
  initialHarvestedUrls,
  northNeedsReview,
  showCercanos,
  showSystem,
  baseline,
  lifetime,
  conversations,
  conversationsWithMemory,
  actDates,
  dose,
  initialSection = "home",
  syncUrl = false,
}: Props) {
  const [section, setSectionState] = useState<CircleSection>(initialSection);
  /**
   * Cambiar de sección reescribe la URL sin recargar. Se usa replaceState y no
   * el router para no volver a pedir los datos al servidor: la pantalla ya los
   * tiene todos y navegar sería tirar abajo el estado por un cambio de vista.
   */
  const setSection = (next: CircleSection) => {
    setSectionState(next);
    if (syncUrl && typeof window !== "undefined") {
      window.history.replaceState(null, "", CIRCLE_SECTION_PATHS[next]);
    }
  };
  const [config, setConfig] = useState(initialConfig);
  const [editions, setEditions] = useState(initialEditions);
  const [sources, setSources] = useState(initialSources);
  const [contacts, setContacts] = useState(initialContacts);
  const [channels, setChannels] = useState(initialChannels);
  const [fronts, setFronts] = useState(initialFronts);
  const [migration, setMigration] = useState(initialMigration);
  const [inventory, setInventory] = useState(initialInventory);
  const [harvest, setHarvest] = useState(initialHarvest);
  const [harvested, setHarvested] = useState<Set<string>>(
    () => new Set(initialHarvestedUrls),
  );
  const [isGenerating, startGenerating] = useTransition();
  const [isCompleting, startCompleting] = useTransition();
  const [isReopening, startReopening] = useTransition();

  // La capa fabricada. Un solo lugar para que ningún acto pueda celebrarse por
  // su cuenta: si algo dispara un premio, pasa por acá.
  const [reward, setReward] = useState<Reward | null>(null);
  // El contrato se muestra mientras la persona se está instalando y se puede
  // volver a leer siempre en Ajustes. No hace falta persistir que lo leyó: se
  // retira solo cuando el setup termina.
  const [contractDismissed, setContractDismissed] = useState(false);

  const edition = editions[0] ?? null;
  const items = edition?.items ?? [];
  const newsItems = items.filter((item) => item.kind === "NEWS");
  const channelItems = items.filter((item) => item.kind === "CHANNEL");
  const delivery = windowState(config.sendHours);
  const checklist = cutChecklist({
    peopleTotal: contacts.length,
    peopleWithPhone: contacts.filter((contact) => Boolean(contact.phone))
      .length,
    referencesTotal: sources.filter(
      (source) => source.isActive && source.category !== "CLOSE",
    ).length,
    referencesWithChannel: sources.filter(
      (source) =>
        source.isActive &&
        source.category !== "CLOSE" &&
        (channels[source.id] ?? []).length > 0,
    ).length,
    pendingInventory: inventory.filter((item) => item.decision === "PENDING")
      .length,
  });

  const references = sources.filter(
    (source) => source.isActive && source.category !== "CLOSE",
  );

  // El espejo: nada de esto se fabrica, todo salió de algo que la persona hizo.
  const mirror = buildMirror({
    followedAtStart: baseline?.followedAtStart ?? null,
    sourcesNow: references.length,
    peopleNow: contacts.length,
    conversations,
    conversationsWithMemory,
    habitsAlive: lifetime.habitsAlive,
    tasksDone: lifetime.tasksDone,
    converted: lifetime.converted,
    daysWithoutInstagram: migration.daysWithout,
  });

  const streak = weeklyStreak(
    actDates.map((iso) => new Date(iso)),
    new Date(),
  );

  // La ventana enfocada de Instagram (extensión de escritorio) salió de acá:
  // una sección que declara en el minuto cero que te va a ir sacando las armas
  // no puede tener un cajón con una puerta a Instagram adentro. Para el
  // referente que sólo publica ahí está el puente, en Referentes.


  const generate = () => {
    startGenerating(async () => {
      const result = await generateNewsletterNowAction();
      if (result.error || !result.edition) {
        toast.error(result.error ?? "No pudimos actualizar Mi Círculo.");
        return;
      }
      setEditions((current) => [
        result.edition!,
        ...current.filter((item) => item.id !== result.edition!.id),
      ]);
      toast.success("Mi Círculo está actualizado.");
    });
  };

  const openItem = (item: SerializedBriefItem) => {
    window.open(item.url, "_blank", "noopener,noreferrer");
    if (edition) {
      recordBriefItemOpenedAction(edition.id, item.url)
        .then((result) => {
          if (!result.success || result.reviewedCount === undefined) return;
          setEditions((current) =>
            current.map((entry) =>
              entry.id === edition.id
                ? { ...entry, reviewedCount: result.reviewedCount! }
                : entry,
            ),
          );
        })
        .catch(() => {});
    }
  };

  const completeEdition = () => {
    if (!edition) return;
    startCompleting(async () => {
      const result = await markNewsletterReadAction(edition.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setEditions((current) =>
        current.map((entry) =>
          entry.id === edition.id
            ? { ...entry, isRead: true, completedAt: new Date().toISOString() }
            : entry,
        ),
      );
      // Llegar al final es algo que Instagram estructuralmente no te puede dar.
      setReward({
        title: "Terminaste",
        detail:
          "No hay más. Eso es todo lo que había hoy y ya lo viste: podés cerrar la app.",
      });
    });
  };

  const reopenEdition = () => {
    if (!edition) return;
    startReopening(async () => {
      const result = await reopenBriefEditionAction(edition.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setEditions((current) =>
        current.map((entry) =>
          entry.id === edition.id
            ? { ...entry, isRead: false, completedAt: null }
            : entry,
        ),
      );
    });
  };

  /**
   * La Cosecha: convertir una pieza en algo que vive en la app. Se marca al
   * instante en el cliente porque el informe completo lo recalcula el server en
   * la próxima carga.
   */
  const harvestItem = async (
    item: SerializedBriefItem,
    outcome: "TASK" | "HABIT" | "NOTE",
  ) => {
    const result = await harvestItemAction({
      itemTitle: item.title,
      itemUrl: item.url,
      sourceId: item.sourceId,
      frontId: frontForTopic(item.topic, fronts)?.id ?? null,
      outcome,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setHarvested((current) => new Set(current).add(item.url));
    setHarvest((current) => {
      const converted = current.converted + 1;
      return {
        ...current,
        converted,
        conversionRate:
          current.opened === 0
            ? current.conversionRate
            : Math.min(100, Math.round((converted / current.opened) * 100)),
        byOutcome: {
          task: current.byOutcome.task + (outcome === "TASK" ? 1 : 0),
          habit: current.byOutcome.habit + (outcome === "HABIT" ? 1 : 0),
          note: current.byOutcome.note + (outcome === "NOTE" ? 1 : 0),
        },
      };
    });
    // El pico de la sección. Convertir es el acto más valioso que existe acá y
    // hasta ahora dejaba un tilde gris.
    setReward({
      title:
        outcome === "NOTE" ? "Guardado contra tu Norte" : "Salió del papel",
      detail:
        outcome === "HABIT"
          ? "Leer algo y hacerlo son cosas distintas. Esta cruzó."
          : outcome === "TASK"
            ? "Dejó de ser algo que leíste y pasó a ser algo que vas a hacer."
            : "Queda guardado contra el frente al que sirve, no en una pila.",
      outcome:
        outcome === "TASK"
          ? "Ya está en tus tareas"
          : outcome === "HABIT"
            ? "Ya está en tus hábitos"
            : null,
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1380px] px-4 pb-10 sm:px-6 lg:px-8">
      <RewardBurst
        reward={reward}
        full={dose.fullCelebration}
        onDone={() => setReward(null)}
      />
      <header className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => setSection("home")}
            className="text-left"
          >
            <h1 className="font-news text-3xl font-medium tracking-tight text-foreground sm:text-[2.4rem]">
              Mi Círculo
            </h1>
          </button>
          <p className="mt-1 text-sm text-muted">
            Cuidá tus vínculos y leé sólo lo que elegiste.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setSection("settings")}>
            <Settings2 size={16} />
            Ajustes
          </Button>
          <Button onClick={generate} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            {isGenerating ? "Actualizando…" : "Actualizar mi ración"}
          </Button>
        </div>
      </header>

      {section !== "home" && (
        <nav aria-label="Volver al inicio de Mi Círculo" className="mt-5">
          <button
            type="button"
            onClick={() => setSection("home")}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <ArrowLeft size={17} />
            Volver a Mi Círculo
          </button>
        </nav>
      )}

      {section === "home" && (
        <CircleHome
          delivery={delivery}
          edition={edition}
          items={items}
          sources={sources}
          radar={initialRadar}
          contacts={contacts}
          channels={channels}
          fronts={fronts}
          harvest={harvest}
          showCercanos={showCercanos}
          showSystem={showSystem}
          onSection={setSection}
          onOpenItem={openItem}
          onHarvest={harvestItem}
          harvested={harvested}
          mirror={mirror}
          streak={streak}
          dose={dose}
          baseline={baseline}
          inventoryPending={
            inventory.filter((item) => item.decision === "PENDING").length
          }
          contractDismissed={contractDismissed}
          onDismissContract={() => setContractDismissed(true)}
        />
      )}
      {section === "cercanos" && showCercanos && (
        <CercanosView
          contacts={contacts}
          onContactsChange={setContacts}
          onReward={setReward}
        />
      )}
      {section === "espejo" && showSystem && (
        <EspejoView
          inventory={inventory}
          baseline={baseline}
          uploadedAt={migration.inventoryUploadedAt}
          onInventoryChange={setInventory}
          onContactAdded={(contact) =>
            setContacts((current) =>
              current.some((item) => item.id === contact.id)
                ? current
                : [...current, contact],
            )
          }
          onSourceAdded={(source) =>
            setSources((current) =>
              current.some((item) => item.id === source.id)
                ? current
                : [...current, source],
            )
          }
          onReward={setReward}
          onContinue={() => setSection("home")}
        />
      )}
      {section === "referentes" && showSystem && (
        <ReferentesView
          sources={sources}
          channels={channels}
          onSourcesChange={setSources}
          onChannelsChange={setChannels}
        />
      )}
      {section === "norte" && showSystem && (
        <NorteView
          fronts={fronts}
          needsReview={northNeedsReview}
          onFrontsChange={setFronts}
        />
      )}
      {section === "cosecha" && showSystem && (
        <CosechaView
          report={harvest}
          mirror={mirror}
          onReward={setReward}
          onSourcePruned={(sourceId) => {
            setSources((current) =>
              current.filter((item) => item.id !== sourceId),
            );
            setHarvest((current) => ({
              ...current,
              sources: current.sources.filter(
                (item) => item.sourceId !== sourceId,
              ),
              toPrune: current.toPrune.filter(
                (item) => item.sourceId !== sourceId,
              ),
            }));
          }}
        />
      )}
      {section === "mudanza" && showSystem && (
        <MudanzaView
          migration={migration}
          checklist={checklist}
          onMigrationChange={setMigration}
          onOpenEspejo={() => setSection("espejo")}
        />
      )}
      {section === "news" && (
        <NewsView
          items={newsItems}
          channelItems={channelItems}
          onOpenItem={openItem}
          onHarvest={harvestItem}
          harvested={harvested}
          showHarvest={showSystem}
          edition={edition}
          isCompleting={isCompleting}
          isReopening={isReopening}
          onComplete={completeEdition}
          onReopen={reopenEdition}
          mirror={mirror}
        />
      )}
      {section === "radar" && <RadarView radar={initialRadar} fronts={fronts} />}
      {section === "settings" && (
        <CircleSettings
          config={config}
          onSaved={setConfig}
          onBack={() => setSection("home")}
          fronts={fronts}
          showSystem={showSystem}
          onOpenNorth={() => setSection("norte")}
          dose={dose}
          mirror={mirror}
        />
      )}
    </div>
  );
}

/**
 * El inicio.
 *
 * Dejó de ser un panel de tareas. Antes decía "3 por revisar", "0 de 9
 * revisadas" y tenía una barra de progreso de lectura — que premiaba
 * porcentaje consumido, o sea exactamente lo único que este producto no puede
 * premiar. Instagram nunca te dice cuánto te falta: abrís y ya te dio algo.
 *
 * Lo que ocupa ese lugar ahora es la anticipación (qué trae hoy la edición) y
 * la racha por actos, que no se rompe con un día vacío.
 */
function CircleHome({
  delivery,
  edition,
  items,
  sources,
  radar,
  contacts,
  channels,
  fronts,
  harvest,
  showCercanos,
  showSystem,
  onSection,
  onOpenItem,
  onHarvest,
  harvested,
  mirror,
  streak,
  dose,
  baseline,
  inventoryPending,
  contractDismissed,
  onDismissContract,
}: {
  delivery: ReturnType<typeof windowState>;
  edition: SerializedEdition | null;
  items: SerializedBriefItem[];
  sources: SerializedBriefSource[];
  radar: SerializedDiscoveryCandidate[];
  contacts: CircleContact[];
  channels: Record<string, SerializedChannel[]>;
  fronts: SerializedFront[];
  harvest: HarvestReport;
  showCercanos: boolean;
  showSystem: boolean;
  onSection: (section: CircleSection) => void;
  onOpenItem: (item: SerializedBriefItem) => void;
  onHarvest: (
    item: SerializedBriefItem,
    outcome: "TASK" | "HABIT" | "NOTE",
  ) => Promise<void>;
  harvested: Set<string>;
  mirror: Mirror;
  streak: Streak;
  dose: ScaffoldDose;
  baseline: CircleBaseline | null;
  inventoryPending: number;
  contractDismissed: boolean;
  onDismissContract: () => void;
}) {
  // El gancho diario de la sección. Va arriba de todo a propósito: durante la
  // transición desde Instagram, el contenido no alcanza para traer a alguien
  // todos los días — una persona esperando sí.
  const dueToday = showCercanos ? rankDueContacts(contacts) : [];
  const references = sources.filter(
    (source) => source.isActive && source.category !== "CLOSE",
  );
  const referencesWithChannel = references.filter(
    (source) => (channels[source.id] ?? []).length > 0,
  ).length;
  const rationCount = edition?.items.length ?? 0;
  const rationMinutes =
    rationCount === 0
      ? 0
      : Math.max(2, Math.min(6, Math.ceil(rationCount * 0.45)));
  const pendingReferences = references.length - referencesWithChannel;
  const referencesReady = references.length > 0 && pendingReferences === 0;
  const espejoDone = baseline !== null && inventoryPending === 0;
  const setupComplete =
    fronts.length > 0 &&
    referencesReady &&
    (!showSystem || espejoDone) &&
    (!showCercanos || contacts.length > 0);
  const dashboardItems = items.slice(0, 4);

  // La anticipación: qué trae hoy, dicho antes de que abra. Sólo se anuncia lo
  // que es verdad — el día que no hay nada bueno, lo dice.
  const fromReferences = items.filter((item) => item.kind === "CHANNEL");
  const anticipation = !edition
    ? `Tu próxima edición llega ${delivery.label.toLowerCase()}.`
    : edition.isRead
      ? "Ya leíste lo de hoy. No hay nada más."
      : rationCount === 0
        ? "Hoy no hay nada que valga tu tiempo. Es una respuesta válida."
        : fromReferences.length > 0
          ? `Hoy hay ${fromReferences.length === 1 ? "algo" : `${fromReferences.length} cosas`} de tus referentes.`
          : `${rationCount} ${rationCount === 1 ? "lectura" : "lecturas"}, ${rationMinutes} minutos, y termina.`;

  return (
    <div className="mt-7 space-y-9">
      {/* El contrato acompaña la instalación y después se retira solo. Queda
          siempre disponible en Ajustes. */}
      {!contractDismissed && !setupComplete && (
        <ScaffoldContract dose={dose} onDismiss={onDismissContract} />
      )}

      {dose.mirrorFirst && mirror.isReady && (
        <MirrorPanel mirror={mirror} />
      )}

      <section
        aria-labelledby="circle-dashboard-title"
        className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(19rem,0.7fr)]"
      >
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface/40">
          <header className="flex flex-col gap-3 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                Edición de hoy
              </p>
              <h2
                id="circle-dashboard-title"
                className="mt-1 text-xl font-semibold text-foreground"
              >
                {anticipation}
              </h2>
            </div>
            {rationCount > 0 && (
              <div className="flex items-center gap-3 text-sm text-muted">
                <span>
                  {rationCount} {rationCount === 1 ? "lectura" : "lecturas"}
                </span>
                <span
                  aria-hidden="true"
                  className="h-1 w-1 rounded-full bg-muted-2"
                />
                <span>{rationMinutes} min</span>
              </div>
            )}
          </header>

          {dashboardItems.length > 0 ? (
            <div className="divide-y divide-border px-5 sm:px-7">
              {dashboardItems.map((item, index) => (
                <DashboardStory
                  key={item.id}
                  item={item}
                  lead={index === 0}
                  onOpenItem={onOpenItem}
                  onHarvest={onHarvest}
                  harvested={harvested.has(item.url)}
                  showHarvest={showSystem}
                />
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 sm:px-7">
              <QuietEmpty text="Todavía no hay edición. Cuando la haya, va a ser corta y va a terminar." />
            </div>
          )}

          <footer className="flex flex-col gap-3 border-t border-border bg-surface-2/35 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-xs text-muted">
              {edition?.isRead
                ? "Cerrada hasta la próxima ventana."
                : "Esta es toda la ración."}
            </p>
            <Button variant="secondary" onClick={() => onSection("news")}>
              {edition?.isRead ? "Volver a la edición" : "Ver edición completa"}
              <ArrowRight size={16} />
            </Button>
          </footer>
        </div>

        <aside
          className="rounded-2xl border border-border bg-surface/25 p-5 sm:p-6"
          aria-label="Resumen de hoy"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Tu día
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                Dos cosas, nada más
              </h2>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 size={19} />
            </span>
          </div>

          <div className="mt-6 space-y-6">
            {showCercanos && (
              <DashboardTask
                icon={UsersRound}
                label="Vínculos"
                title={
                  dueToday.length === 0
                    ? "Tu círculo está al día"
                    : dueToday.length === 1
                      ? `Escribile a ${dueToday[0].name}`
                      : `${dueToday.length} personas esperan noticias tuyas`
                }
                detail={
                  dueToday.length === 1
                    ? `Hablaron ${sinceLabel(dueToday[0].daysSince, dueToday[0].neverContacted)}.`
                    : dueToday.length === 0
                      ? "Hoy no hay nadie a quien escribirle."
                      : "Elegí a una persona para empezar."
                }
                complete={dueToday.length === 0}
                onClick={() => onSection("cercanos")}
              />
            )}
            <DashboardTask
              icon={Newspaper}
              label="Lecturas"
              title={
                !edition
                  ? "Edición pendiente"
                  : edition.isRead
                    ? "Terminaste por hoy"
                    : rationCount === 0
                      ? "Hoy no hay nada"
                      : "Tu ración está lista"
              }
              detail={
                !edition
                  ? `Próxima actualización: ${delivery.label.toLowerCase()}.`
                  : edition.isRead
                    ? "No hay más contenido para cargar."
                    : rationCount === 0
                      ? "Mejor tres piezas que valgan que doce de relleno."
                      : `Unos ${rationMinutes} minutos y se termina.`
              }
              complete={Boolean(edition?.isRead) || rationCount === 0}
              onClick={() => onSection("news")}
            />
          </div>

          {/* Donde antes había una barra de progreso de lectura. La racha
              cuenta actos por semana, así que un día sin nada no cuesta nada. */}
          {dose.showStreak && (
            <div className="mt-7 border-t border-border pt-5">
              <StreakChip streak={streak} />
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Cuentan las conversaciones y lo que convertís, no las veces que
                entrás.
              </p>
            </div>
          )}
        </aside>
      </section>

      {showSystem && !setupComplete && (
        <section aria-labelledby="circle-setup-title">
          <h2
            id="circle-setup-title"
            className="text-lg font-semibold text-foreground"
          >
            Prepará Mi Círculo
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm text-muted">
            Es trabajo, y es a propósito: lo que sale de acá es tuyo y no lo
            elige un algoritmo. Se hace una vez.
          </p>
          <div className="mt-4 divide-y divide-border border-y border-border">
            {/* Primero el espejo: es lo que llena los otros dos pasos y lo
                único que se puede capturar una sola vez en la vida. */}
            <SetupStep
              complete={espejoDone}
              title={
                inventoryPending > 0
                  ? `Clasificá ${inventoryPending} cuentas`
                  : "Mirá a quién estás siguiendo"
              }
              detail="Tu lista real de seguidos, repartida en gente, obra y ruido. De acá salen tus personas y tus referentes."
              action={inventoryPending > 0 ? "Seguir clasificando" : "Abrir El Espejo"}
              onClick={() => onSection("espejo")}
            />
            <SetupStep
              complete={referencesReady}
              title={
                pendingReferences > 0
                  ? `Conectá ${pendingReferences} ${pendingReferences === 1 ? "referente" : "referentes"}`
                  : "Sumá un referente"
              }
              detail="Pegá su blog, canal o newsletter para leer su contenido sin entrar a una red."
              action="Ir a Referentes"
              onClick={() => onSection("referentes")}
            />
            {showCercanos && (
              <SetupStep
                complete={contacts.length > 0}
                title="Confirmá a las personas que querés cuidar"
                detail="Sólo aparecen cuando llega el momento de volver a hablar."
                action="Ir a Cercanos"
                onClick={() => onSection("cercanos")}
              />
            )}
            <SetupStep
              complete={fronts.length > 0}
              title="Definí qué querés aprender"
              detail="El Norte decide qué información entra y cuál queda afuera. Va último porque después de ver tu lista sabés mejor qué querés."
              action="Definir mi Norte"
              onClick={() => onSection("norte")}
            />
          </div>
        </section>
      )}

      {!dose.mirrorFirst && mirror.isReady && <MirrorPanel mirror={mirror} />}

      <section aria-labelledby="circle-tools-title">
        <h2
          id="circle-tools-title"
          className="text-lg font-semibold text-foreground"
        >
          Para cuando lo necesites
        </h2>
        <p className="mt-1 text-sm text-muted">
          No hace falta entrar a estas secciones todos los días.
        </p>
        <div className="mt-4 divide-y divide-border border-y border-border">
          <ToolRow
            icon={Rss}
            title="Referentes"
            description="Elegí de quién aprender y traé su contenido a Control.io."
            status={`${referencesWithChannel} de ${references.length} conectados`}
            onClick={() => onSection("referentes")}
          />
          <ToolRow
            icon={Radar}
            title="Radar"
            description="Lo que está en la agenda general y toca alguno de tus frentes."
            status={`${Math.min(3, radar.length)} señales hoy`}
            onClick={() => onSection("radar")}
          />
          {showSystem && (
            <>
              <ToolRow
                icon={Sprout}
                title="La Cosecha"
                description="Revisá qué lecturas se volvieron tareas, hábitos o notas."
                status={`${harvest.conversionRate}% convertido este mes`}
                onClick={() => onSection("cosecha")}
              />
              <ToolRow
                icon={Eye}
                title="El Espejo"
                description="A quién seguías cuando empezaste, y cómo quedó repartido."
                status={baseline ? `${baseline.followedAtStart} cuentas` : "Sin abrir"}
                onClick={() => onSection("espejo")}
              />
              <ToolRow
                icon={PackageOpen}
                title="La Mudanza"
                description="Sacarte Instagram de encima, si algún día querés."
                status="Opcional"
                onClick={() => onSection("mudanza")}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function DashboardStory({
  item,
  lead,
  onOpenItem,
  onHarvest,
  harvested,
  showHarvest,
}: {
  item: SerializedBriefItem;
  lead: boolean;
  onOpenItem: (item: SerializedBriefItem) => void;
  onHarvest: (
    item: SerializedBriefItem,
    outcome: "TASK" | "HABIT" | "NOTE",
  ) => Promise<void>;
  harvested: boolean;
  showHarvest: boolean;
}) {
  const [isHarvesting, startHarvesting] = useTransition();

  return (
    <article className={lead ? "py-6" : "py-5"}>
      <button
        type="button"
        onClick={() => onOpenItem(item)}
        className="group block w-full text-left"
      >
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="font-semibold uppercase tracking-[0.1em] text-primary">
            {item.topic || "Actualidad"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {metadataText(item.metadata, "source") || "Fuente verificada"}
          </span>
        </span>
        <span
          className={`mt-2 block font-semibold leading-tight text-foreground transition-colors group-hover:text-primary ${lead ? "text-xl sm:text-2xl" : "text-base sm:text-lg"}`}
        >
          {item.title}
        </span>
        {item.summary && (
          <span
            className={`mt-2 block max-w-[70ch] text-sm leading-relaxed text-muted ${lead ? "line-clamp-3" : "line-clamp-2"}`}
          >
            {item.summary}
          </span>
        )}
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onOpenItem(item)}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80"
        >
          Leer noticia <ExternalLink size={14} />
        </button>
        {showHarvest && (
          <HarvestButtons
            busy={isHarvesting}
            done={harvested}
            onHarvest={(outcome) =>
              startHarvesting(async () => {
                await onHarvest(item, outcome);
              })
            }
          />
        )}
      </div>
    </article>
  );
}

function DashboardTask({
  icon: Icon,
  label,
  title,
  detail,
  complete,
  onClick,
}: {
  icon: typeof Instagram;
  label: string;
  title: string;
  detail: string;
  complete: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-16 w-full gap-3 text-left"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${complete ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}
      >
        {complete ? <CheckCircle2 size={17} /> : <Icon size={17} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted">
          {label}
        </span>
        <span className="mt-1 flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
          {title}
          <ArrowRight
            size={15}
            className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">
          {detail}
        </span>
      </span>
    </button>
  );
}

function SetupStep({
  complete,
  title,
  detail,
  action,
  onClick,
}: {
  complete: boolean;
  title: string;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${complete ? "bg-success/10 text-success" : "border border-border text-muted"}`}
      >
        {complete ? (
          <CheckCircle2 size={16} />
        ) : (
          <span className="h-2 w-2 rounded-full bg-muted" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold ${complete ? "text-muted" : "text-foreground"}`}
        >
          {title}
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted">{detail}</p>
      </div>
      {!complete && (
        <Button
          variant="secondary"
          onClick={onClick}
          className="w-full sm:w-auto"
        >
          {action}
        </Button>
      )}
    </div>
  );
}

function ToolRow({
  icon: Icon,
  title,
  description,
  status,
  onClick,
}: {
  icon: typeof Instagram;
  title: string;
  description: string;
  status: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-20 w-full items-center gap-4 py-4 text-left"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted transition-colors group-hover:text-primary">
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-muted">
          {description}
        </span>
      </span>
      <span className="hidden shrink-0 text-xs text-muted sm:block">
        {status}
      </span>
      <ArrowRight
        size={17}
        className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </button>
  );
}


/**
 * Una pieza de la edición. La fila no puede ser un `<button>` entero: los
 * botones de La Cosecha viven adentro, y un botón dentro de otro es HTML
 * inválido (además de romper el foco con teclado).
 */
function BriefItemRow({
  item,
  index,
  onOpenItem,
  onHarvest,
  harvested,
  showHarvest,
}: {
  item: SerializedBriefItem;
  index: number;
  onOpenItem: (item: SerializedBriefItem) => void;
  onHarvest: (
    item: SerializedBriefItem,
    outcome: "TASK" | "HABIT" | "NOTE",
  ) => Promise<void>;
  harvested: boolean;
  showHarvest: boolean;
}) {
  const [isHarvesting, startHarvesting] = useTransition();

  return (
    <div className="grid gap-3 py-5 md:grid-cols-[2.5rem_1fr]">
      <span className="font-news text-2xl text-muted-2">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => onOpenItem(item)}
          className="block w-full text-left"
        >
          <span className="block font-news text-xl leading-snug text-foreground">
            {item.title}
          </span>
          {item.summary && (
            <span className="mt-2 block max-w-[70ch] text-sm leading-relaxed text-muted">
              {item.summary}
            </span>
          )}
          {item.inclusionReason && (
            <span className="mt-2 block text-xs text-primary">
              {item.inclusionReason}
            </span>
          )}
        </button>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2 text-xs text-muted">
            <ShieldCheck size={14} className="text-success" />
            {metadataText(item.metadata, "source") || "Fuente verificada"}
            <ExternalLink size={13} />
          </span>
          {showHarvest && (
            <HarvestButtons
              busy={isHarvesting}
              done={harvested}
              onHarvest={(outcome) =>
                startHarvesting(async () => {
                  await onHarvest(item, outcome);
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function NewsView({
  items,
  channelItems,
  onOpenItem,
  onHarvest,
  harvested,
  showHarvest,
  edition,
  isCompleting,
  isReopening,
  onComplete,
  onReopen,
  mirror,
}: {
  items: SerializedBriefItem[];
  channelItems: SerializedBriefItem[];
  onOpenItem: (item: SerializedBriefItem) => void;
  onHarvest: (
    item: SerializedBriefItem,
    outcome: "TASK" | "HABIT" | "NOTE",
  ) => Promise<void>;
  harvested: Set<string>;
  showHarvest: boolean;
  edition: SerializedEdition | null;
  isCompleting: boolean;
  isReopening: boolean;
  onComplete: () => void;
  onReopen: () => void;
  mirror: Mirror;
}) {
  const groups = topicGroups(items);
  const visibleCount = items.length + channelItems.length;
  const readingMinutes =
    visibleCount === 0
      ? 0
      : Math.max(2, Math.min(6, Math.ceil(visibleCount * 0.45)));

  // El cierre. Es el momento más importante del producto: llegar al final es
  // algo que Instagram estructuralmente no te puede dar. Acá convergen las dos
  // capas — la celebración la disparó el acto, y lo que queda en pantalla es el
  // espejo, que no lo fabrica nadie.
  if (edition?.isRead) {
    return (
      <section className="py-14" aria-live="polite">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/12 text-success">
            <CheckCircle2 size={24} />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-success">
            Edición terminada
          </p>
          <h2 className="mt-2 font-news text-3xl text-foreground">
            Llegaste al final
          </h2>
          <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-muted">
            No hay más para cargar hasta la próxima ventana. Podés cerrar la
            app: acá terminó de verdad.
          </p>
        </div>

        {mirror.isReady && (
          <div className="mx-auto mt-9 max-w-2xl">
            <MirrorPanel mirror={mirror} compact />
          </div>
        )}

        <div className="mt-8 text-center">
          <Button
            variant="secondary"
            onClick={onReopen}
            disabled={isReopening}
          >
            {isReopening && <Loader2 size={16} className="animate-spin" />}
            Volver al contenido de hoy
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="Edición finita"
        title="Noticias"
        description="Hasta tres noticias por tema, con su fuente y el motivo por el que fueron seleccionadas."
      />

      {edition && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/55 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {visibleCount} {visibleCount === 1 ? "pieza" : "piezas"} ·{" "}
              {readingMinutes} min
            </p>
            <p className="mt-1 text-xs text-muted">
              Esta es toda la ración. No se carga contenido infinito al final.
            </p>
          </div>
          <span className="text-xs text-muted">
            {edition.reviewedCount} revisadas
          </span>
        </div>
      )}

      {channelItems.length > 0 && (
        <section className="mt-7">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <h2 className="font-news text-2xl text-foreground">
              De tus referentes
            </h2>
            <span className="text-xs text-muted">
              {channelItems.length}{" "}
              {channelItems.length === 1 ? "pieza" : "piezas"}
            </span>
          </div>
          <div className="divide-y divide-border">
            {channelItems.map((item, index) => (
              <BriefItemRow
                key={item.id}
                item={item}
                index={index}
                onOpenItem={onOpenItem}
                onHarvest={onHarvest}
                harvested={harvested.has(item.url)}
                showHarvest={showHarvest}
              />
            ))}
          </div>
        </section>
      )}
      <div className="mt-7 space-y-10">
        {groups.map(([topic, topicItems]) => (
          <section key={topic}>
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <h2 className="font-news text-2xl text-foreground">{topic}</h2>
              <span className="text-xs text-muted">
                {topicItems.length} de 3
              </span>
            </div>
            <div className="divide-y divide-border">
              {topicItems.map((item, index) => (
                <BriefItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  onOpenItem={onOpenItem}
                  onHarvest={onHarvest}
                  harvested={harvested.has(item.url)}
                  showHarvest={showHarvest}
                />
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <QuietEmpty
            text={
              showHarvest
                ? "Todavía no hay noticias. Definí tu Norte y actualizá la edición."
                : "Todavía no hay noticias. Agregá temas en Ajustes y actualizá tu edición."
            }
          />
        )}
      </div>

      {edition && visibleCount > 0 && (
        <div className="mt-10 border-t border-border pb-3 pt-8 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-success/12 text-success">
            <CheckCircle2 size={20} />
          </span>
          <h2 className="mt-3 font-news text-2xl text-foreground">
            Llegaste al final
          </h2>
          <p className="mx-auto mt-2 max-w-[42ch] text-sm leading-relaxed text-muted">
            Lo que servía podía convertirse en tarea, hábito o nota. Lo demás
            termina acá.
          </p>
          <Button
            onClick={onComplete}
            disabled={isCompleting}
            className="mt-5 w-full sm:w-auto"
          >
            {isCompleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            {isCompleting ? "Cerrando…" : "Terminé por hoy"}
          </Button>
          <p className="mt-3 text-xs text-muted">
            No vamos a cargar más contenido después de esto.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Radar, acotado al Norte.
 *
 * Era la única parte de la sección que ofrecía contenido que la persona no
 * eligió, sin destino y sin fondo — es decir, la puerta de atrás por donde se
 * colaba el feed. Ahora sólo entra lo que toca alguno de tus frentes, y si hoy
 * no toca nada, lo dice y se termina.
 */
function RadarView({
  radar,
  fronts,
}: {
  radar: SerializedDiscoveryCandidate[];
  fronts: SerializedFront[];
}) {
  const relevantes =
    fronts.length === 0
      ? []
      : radar.filter((trend) => frontForTopic(trend.topic, fronts) !== null);

  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="Fuera de tu selección"
        title="Lo que está pasando hoy"
        description="De la agenda general entra sólo lo que toca alguno de tus frentes. El resto no es información para vos: es novedad."
      />
      <div className="mt-7 overflow-hidden rounded-xl border border-border bg-surface/50 px-4 sm:px-6">
        {fronts.length === 0 ? (
          <QuietEmpty text="Sin frentes declarados no hay con qué filtrar la agenda del día. Definí tu Norte y el Radar empieza a servir." />
        ) : relevantes.length === 0 ? (
          <QuietEmpty text="Hoy no hay nada en la agenda general que toque tus frentes. Es una respuesta válida." />
        ) : (
          <TrendTable radar={relevantes} />
        )}
      </div>
    </section>
  );
}

function TrendTable({
  radar,
  compact = false,
}: {
  radar: SerializedDiscoveryCandidate[];
  compact?: boolean;
}) {
  const trends = radar.slice(0, 3);

  if (trends.length === 0) {
    return (
      <QuietEmpty text="Todavía no hay un panorama confiable del día. Volvé a actualizar en unos minutos." />
    );
  }

  return (
    <div className="divide-y divide-border">
      {trends.map((trend, index) => {
        const publishedAt = metadataText(trend.signals, "latestPublishedAt");
        const reputable = trend.signals?.reputable === true;
        return (
          <article
            key={trend.id}
            className={`grid gap-3 py-5 ${
              compact
                ? "grid-cols-[2rem_1fr_auto]"
                : "md:grid-cols-[2.5rem_1fr_auto] md:gap-5 md:py-6"
            }`}
          >
            <span className="font-news text-xl text-muted-2">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
                En auge hoy
              </p>
              <h3
                className={`mt-1 text-foreground ${
                  compact
                    ? "line-clamp-2 text-sm font-semibold leading-snug"
                    : "font-news text-xl leading-snug sm:text-2xl"
                }`}
              >
                {trend.topic || trend.sourceName}
              </h3>
              {!compact && (
                <p className="mt-3 max-w-[70ch] text-sm leading-relaxed text-muted">
                  {trend.explanation}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span>{trend.sourceName}</span>
                <span aria-hidden="true">·</span>
                <span>{timeAgo(publishedAt)}</span>
                {reputable && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-success">
                      <ShieldCheck size={13} />
                      Fuente reconocida
                    </span>
                  </>
                )}
              </div>
            </div>
            <a
              href={trend.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Leer noticia: ${trend.topic || trend.sourceName}`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-primary transition-colors hover:bg-primary/8"
            >
              <ExternalLink size={17} />
            </a>
          </article>
        );
      })}
    </div>
  );
}

function CircleSettings({
  config,
  onSaved,
  onBack,
  fronts,
  showSystem,
  onOpenNorth,
  dose,
  mirror,
}: {
  config: SerializedConfig;
  onSaved: (config: SerializedConfig) => void;
  onBack: () => void;
  fronts: SerializedFront[];
  showSystem: boolean;
  onOpenNorth: () => void;
  dose: ScaffoldDose;
  mirror: Mirror;
}) {
  const [topics, setTopics] = useState(config.topics);
  const [topic, setTopic] = useState("");
  const [hours, setHours] = useState(config.sendHours);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(config.notifyWhatsapp);
  const [isSaving, startSaving] = useTransition();

  const addTopic = () => {
    const clean = topic.trim();
    if (
      !clean ||
      topics.some((item) => item.toLowerCase() === clean.toLowerCase())
    )
      return;
    if (topics.length >= 12) {
      toast.error("Podés configurar hasta 12 temas.");
      return;
    }
    setTopics([...topics, clean]);
    setTopic("");
  };

  const save = () => {
    if (topics.length === 0 && fronts.length === 0) {
      toast.error("Definí al menos un frente en El Norte.");
      return;
    }
    startSaving(async () => {
      const result = await saveNewsletterConfigAction({
        ...config,
        topics,
        priorityTopics: config.priorityTopics.filter((item) =>
          topics.includes(item),
        ),
        sendHour: hours[0],
        sendHours: hours,
        notifyOnReady: notifyWhatsapp || config.notifyPush,
        notifyWhatsapp,
      });
      if (result.error || !result.config) {
        toast.error(result.error ?? "No pudimos guardar los ajustes.");
        return;
      }
      onSaved(result.config);
      toast.success("Ajustes guardados.");
      onBack();
    });
  };

  const resizeHours = (count: number) => {
    const suggestions = [8, 13, 19];
    const next = [...hours];
    while (next.length < count) {
      next.push(suggestions.find((hour) => !next.includes(hour)) ?? 8);
    }
    setHours(next.slice(0, count).sort((a, b) => a - b));
  };

  return (
    <section className="mt-7 max-w-4xl">
      <SectionHeading
        eyebrow="Preferencias"
        title="Ajustes de Mi Círculo"
        description="Elegí qué querés saber y en qué momentos querés recibirlo."
      />

      {/* El retiro del andamio es declarado: acá se puede leer siempre en qué
          fase está y qué significa. Una app que se retira sin avisar parece que
          te abandona; avisando, es una promesa que se cumple. */}
      <div className="mt-7 space-y-4">
        <ScaffoldContract dose={dose} />
        {dose.phase === "RETIRO" && mirror.isReady && (
          <MirrorPanel mirror={mirror} title="Mirá lo que juntaste" compact />
        )}
      </div>

      <div className="mt-7 space-y-8 rounded-xl border border-border bg-surface/55 p-5 sm:p-7">
        {showSystem ? (
          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
            <p className="text-sm font-semibold text-foreground">
              Los temas salen de El Norte
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Ya no hace falta mantener dos listas. Tus frentes deciden qué
              entra en la edición.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...new Set(fronts.flatMap((front) => front.topics))]
                .slice(0, 12)
                .map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-surface-2 px-3 py-1.5 text-xs text-foreground"
                  >
                    {item}
                  </span>
                ))}
              {fronts.length === 0 && (
                <span className="text-xs text-warning">
                  Todavía no definiste ningún frente.
                </span>
              )}
            </div>
            <Button variant="secondary" onClick={onOpenNorth} className="mt-4">
              <Compass size={16} />
              {fronts.length === 0 ? "Definir mi Norte" : "Revisar mi Norte"}
            </Button>
          </div>
        ) : (
          <div>
            <label
              htmlFor="circle-topic"
              className="text-sm font-semibold text-foreground"
            >
              Temas de interés
            </label>
            <p className="mt-1 text-xs text-muted">
              Escribilos libremente. Las noticias mostrarán hasta tres
              resultados por tema.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                id="circle-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTopic();
                  }
                }}
                placeholder="Ejemplo: inteligencia artificial"
              />
              <Button variant="secondary" onClick={addTopic}>
                <Plus size={16} />
                Agregar
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {topics.map((item) => (
                <span
                  key={item}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-surface-2 px-3 text-sm text-foreground"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() =>
                      setTopics(topics.filter((value) => value !== item))
                    }
                    aria-label={`Quitar ${item}`}
                    className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-surface-3 hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-foreground">
            Ventanas diarias
          </p>
          <p className="mt-1 text-xs text-muted">
            Al comenzar cada ventana se actualiza la edición y se envía el
            reporte por WhatsApp.
          </p>
          <div className="mt-3 flex gap-2">
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => resizeHours(count)}
                className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${
                  hours.length === count
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {hours.map((hour, index) => (
              <label key={index} className="text-xs text-muted">
                Ventana {index + 1}
                <select
                  value={hour}
                  onChange={(event) => {
                    const next = [...hours];
                    next[index] = Number(event.target.value);
                    setHours([...new Set(next)].sort((a, b) => a - b));
                  }}
                  className="mt-1 block h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-foreground"
                >
                  {Array.from({ length: 24 }, (_, value) => (
                    <option key={value} value={value}>
                      {formatWindow(value)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Reporte por WhatsApp
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Incluye el enlace directo y los referentes pendientes de
              consultar.
            </span>
          </span>
          <input
            type="checkbox"
            checked={notifyWhatsapp}
            onChange={(event) => setNotifyWhatsapp(event.target.checked)}
            className="h-5 w-5 accent-primary"
          />
        </label>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onBack}>
            Volver sin guardar
          </Button>
          <Button onClick={save} disabled={isSaving}>
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            {isSaving ? "Guardando…" : "Guardar ajustes"}
          </Button>
        </div>
      </div>
    </section>
  );
}
