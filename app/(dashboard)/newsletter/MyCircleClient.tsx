"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Compass,
  ExternalLink,
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
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createBriefSourceAction,
  deleteBriefSourceAction,
  generateNewsletterNowAction,
  markNewsletterReadAction,
  recordBriefItemOpenedAction,
  reopenBriefEditionAction,
  saveNewsletterConfigAction,
} from "@/app/actions/newsletter";
import type {
  SerializedConfig,
  SerializedEdition,
} from "@/lib/db/newsletter";
import type {
  SerializedBriefItem,
  SerializedBriefSource,
  SerializedDiscoveryCandidate,
} from "@/lib/brief/types";
import type { CircleContact } from "@/lib/db/circle";
import type { SerializedChannel } from "@/lib/db/channels";
import type { SerializedFront } from "@/lib/db/circle-north";
import type { HarvestReport } from "@/lib/db/circle-harvest";
import type {
  SerializedInventoryItem,
  SerializedMigration,
} from "@/lib/db/circle-migration";
import { cutChecklist } from "@/lib/circle-inventory";
import { rankDueContacts, sinceLabel } from "@/lib/circle-cadence";
import { frontForTopic } from "@/lib/circle-north";
import { harvestItemAction } from "@/app/actions/circle-system";
import { CercanosView } from "./CercanosView";
import { CosechaView, HarvestButtons } from "./CosechaView";
import { ReferentesView } from "./ReferentesView";
import { NorteView } from "./NorteView";
import { MudanzaView } from "./MudanzaView";
import { SectionHeading, QuietEmpty } from "./CircleUI";

type CircleSection =
  | "home"
  | "cercanos"
  | "referentes"
  | "instagram"
  | "news"
  | "radar"
  | "norte"
  | "cosecha"
  | "mudanza"
  | "settings";

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
};

function metadataText(
  metadata: Record<string, unknown> | null,
  key: string
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
    (hour + 1) % 24
  ).padStart(2, "0")}:00`;
}

function windowState(hours: number[]) {
  const now = new Date();
  const current = now.getHours();
  const sorted = [...hours].sort((a, b) => a - b);
  const active = sorted.find((hour) => current === hour);
  if (active !== undefined) {
    return { active: true, hour: active, label: `Ahora, ${formatWindow(active)}` };
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

function openFocusedInstagram(handle: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const correlationId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", receive);
      reject(
        new Error(
          "Control.io Focus no respondió. Instalá o actualizá la extensión."
        )
      );
    }, 5000);

    function receive(event: MessageEvent) {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.source !== "controlio-focus-extension" ||
        event.data?.type !== "CONTROLIO_FOCUS_OPEN_RESULT" ||
        event.data?.correlationId !== correlationId
      ) {
        return;
      }
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
      if (event.data.ok) resolve();
      else
        reject(
          new Error(
            event.data.error || "No pudimos abrir la ventana enfocada."
          )
        );
    }

    window.addEventListener("message", receive);
    window.postMessage(
      {
        source: "controlio-web",
        type: "CONTROLIO_FOCUS_OPEN",
        correlationId,
        durationSeconds: 180,
        handle,
      },
      window.location.origin
    );
  });
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
}: Props) {
  const [section, setSection] = useState<CircleSection>("home");
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

  const edition = editions[0] ?? null;
  const items = edition?.items ?? [];
  const newsItems = items.filter((item) => item.kind === "NEWS");
  const channelItems = items.filter((item) => item.kind === "CHANNEL");
  const instagramSources = sources.filter(
    (source) => source.account?.platform === "INSTAGRAM"
  );
  const delivery = windowState(config.sendHours);
  const checklist = cutChecklist({
    peopleTotal: contacts.length,
    peopleWithPhone: contacts.filter((contact) => Boolean(contact.phone)).length,
    referencesTotal: sources.filter(
      (source) => source.isActive && source.category !== "CLOSE",
    ).length,
    referencesWithChannel: sources.filter(
      (source) =>
        source.isActive &&
        source.category !== "CLOSE" &&
        (channels[source.id] ?? []).length > 0,
    ).length,
    pendingInventory: inventory.filter((item) => item.decision === "PENDING").length,
  });

  useEffect(() => {
    document.documentElement.dataset.controlioFocusAuthorized = "true";
    return () => {
      delete document.documentElement.dataset.controlioFocusAuthorized;
    };
  }, []);

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
    toast.success(
      outcome === "TASK"
        ? "Quedó como tarea."
        : outcome === "HABIT"
          ? "Quedó como hábito."
          : "Guardado.",
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1380px] px-4 pb-10 sm:px-6 lg:px-8">
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
          <Button
            variant="secondary"
            onClick={() => setSection("settings")}
          >
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
          sources={sources}
          radar={initialRadar}
          contacts={contacts}
          channels={channels}
          fronts={fronts}
          harvest={harvest}
          showCercanos={showCercanos}
          showSystem={showSystem}
          onSection={setSection}
        />
      )}
      {section === "cercanos" && showCercanos && (
        <CercanosView contacts={contacts} onContactsChange={setContacts} />
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
          onSourcePruned={(sourceId) => {
            setSources((current) => current.filter((item) => item.id !== sourceId));
            setHarvest((current) => ({
              ...current,
              sources: current.sources.filter((item) => item.sourceId !== sourceId),
              toPrune: current.toPrune.filter((item) => item.sourceId !== sourceId),
            }));
          }}
        />
      )}
      {section === "mudanza" && showSystem && (
        <MudanzaView
          migration={migration}
          inventory={inventory}
          checklist={checklist}
          onMigrationChange={setMigration}
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
        />
      )}
      {section === "instagram" && (
        <InstagramView
          delivery={delivery}
          sources={instagramSources}
          onSourcesChange={(nextInstagramSources) =>
            setSources((current) => [
              ...current.filter(
                (source) => source.account?.platform !== "INSTAGRAM"
              ),
              ...nextInstagramSources,
            ])
          }
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
        />
      )}
      {section === "radar" && (
        <RadarView radar={initialRadar} />
      )}
      {section === "settings" && (
        <CircleSettings
          config={config}
          onSaved={setConfig}
          onBack={() => setSection("home")}
          fronts={fronts}
          showSystem={showSystem}
          onOpenNorth={() => setSection("norte")}
        />
      )}
    </div>
  );
}

function CircleHome({
  delivery,
  edition,
  sources,
  radar,
  contacts,
  channels,
  fronts,
  harvest,
  showCercanos,
  showSystem,
  onSection,
}: {
  delivery: ReturnType<typeof windowState>;
  edition: SerializedEdition | null;
  sources: SerializedBriefSource[];
  radar: SerializedDiscoveryCandidate[];
  contacts: CircleContact[];
  channels: Record<string, SerializedChannel[]>;
  fronts: SerializedFront[];
  harvest: HarvestReport;
  showCercanos: boolean;
  showSystem: boolean;
  onSection: (section: CircleSection) => void;
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
  const setupComplete =
    fronts.length > 0 &&
    referencesReady &&
    (!showCercanos || contacts.length > 0);

  return (
    <div className="mt-8 max-w-5xl space-y-10">
      <section aria-labelledby="circle-today-title">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
          Empezá acá
        </p>
        <h2 id="circle-today-title" className="mt-2 text-2xl font-semibold text-foreground">
          Para hoy
        </h2>
        <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted">
          Primero cuidá tus vínculos. Después leé una selección corta que se termina.
        </p>

        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-surface/50">
          {showCercanos && (
            <DailyActionRow
              step="1"
              icon={UsersRound}
              title={
                dueToday.length === 0
                  ? "Tus vínculos están al día"
                  : dueToday.length === 1
                    ? `Escribile a ${dueToday[0].name}`
                    : `Tenés ${dueToday.length} personas para contactar`
              }
              detail={
                dueToday.length === 0
                  ? "No hay ninguna conversación pendiente hoy."
                  : dueToday.length === 1
                    ? `La última conversación fue ${sinceLabel(dueToday[0].daysSince, dueToday[0].neverContacted)}.`
                    : dueToday.map((contact) => contact.name).join(" y ")
              }
              action={dueToday.length === 0 ? "Ver personas" : "Ir a Cercanos"}
              complete={dueToday.length === 0}
              onClick={() => onSection("cercanos")}
            />
          )}
          <DailyActionRow
            step={showCercanos ? "2" : "1"}
            icon={Newspaper}
            title={
              !edition
                ? "Tu ración todavía no está lista"
                : edition.isRead
                  ? "Terminaste la ración de hoy"
                  : "Leé tu ración de hoy"
            }
            detail={
              !edition
                ? `Próxima actualización: ${delivery.label.toLowerCase()}.`
                : edition.isRead
                  ? `Vuelve a actualizarse ${delivery.label.toLowerCase()}.`
                  : `${rationCount} piezas, cerca de ${rationMinutes} min. No hay contenido infinito.`
            }
            action={!edition ? "Ver estado" : edition.isRead ? "Volver a verla" : "Empezar a leer"}
            complete={Boolean(edition?.isRead)}
            onClick={() => onSection("news")}
            last
          />
        </div>
      </section>

      {showSystem && !setupComplete && (
        <section aria-labelledby="circle-setup-title">
          <h2 id="circle-setup-title" className="text-lg font-semibold text-foreground">
            Prepará Mi Círculo
          </h2>
          <p className="mt-1 text-sm text-muted">
            Estos pasos se hacen una vez. Después esta guía desaparece.
          </p>
          <div className="mt-4 divide-y divide-border border-y border-border">
            <SetupStep
              complete={fronts.length > 0}
              title="Definí qué querés aprender"
              detail="El Norte decide qué información entra y cuál queda afuera."
              action="Definir mi Norte"
              onClick={() => onSection("norte")}
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
                title="Sumá a las personas que querés cuidar"
                detail="Sólo aparecen cuando llega el momento de volver a hablar."
                action="Agregar personas"
                onClick={() => onSection("cercanos")}
              />
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="circle-tools-title">
        <h2 id="circle-tools-title" className="text-lg font-semibold text-foreground">
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
            description="Mirá qué temas están en la agenda general, fuera de tu selección."
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
                icon={PackageOpen}
                title="La Mudanza"
                description="Pasá a Control.io lo importante que hoy seguís en Instagram."
                status="Proceso opcional"
                onClick={() => onSection("mudanza")}
              />
            </>
          )}
        </div>

        {showSystem && (
          <details className="mt-5 text-sm text-muted">
            <summary className="min-h-11 cursor-pointer py-3 hover:text-foreground">
              Opciones anteriores
            </summary>
            <button
              type="button"
              onClick={() => onSection("instagram")}
              className="inline-flex min-h-11 items-center gap-2 text-muted hover:text-foreground"
            >
              <Clock3 size={15} />
              Abrir la antigua ventana de Instagram
            </button>
          </details>
        )}
      </section>
    </div>
  );
}

function DailyActionRow({
  step,
  icon: Icon,
  title,
  detail,
  action,
  complete,
  onClick,
  last = false,
}: {
  step: string;
  icon: typeof Instagram;
  title: string;
  detail: string;
  action: string;
  complete: boolean;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <div className={`grid grid-cols-[2.5rem_1fr] items-center gap-4 p-5 sm:grid-cols-[2.5rem_2.5rem_1fr_auto] ${last ? "" : "border-b border-border"}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${complete ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
        {complete ? <CheckCircle2 size={19} /> : step}
      </span>
      <span className={`hidden h-10 w-10 shrink-0 place-items-center rounded-lg sm:grid ${complete ? "bg-surface-2 text-muted" : "bg-primary/10 text-primary"}`}>
        <Icon size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{detail}</p>
      </div>
      <Button variant={complete ? "secondary" : "default"} onClick={onClick} className="col-span-2 w-full sm:col-span-1 sm:w-auto">
        {action}
        <ArrowRight size={16} />
      </Button>
    </div>
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
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${complete ? "bg-success/10 text-success" : "border border-border text-muted"}`}>
        {complete ? <CheckCircle2 size={16} /> : <span className="h-2 w-2 rounded-full bg-muted" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${complete ? "text-muted" : "text-foreground"}`}>{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted">{detail}</p>
      </div>
      {!complete && (
        <Button variant="secondary" onClick={onClick} className="w-full sm:w-auto">
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
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-muted">{description}</span>
      </span>
      <span className="hidden shrink-0 text-xs text-muted sm:block">{status}</span>
      <ArrowRight size={17} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

function InstagramView({
  delivery,
  sources,
  onSourcesChange,
}: {
  delivery: ReturnType<typeof windowState>;
  sources: SerializedBriefSource[];
  onSourcesChange: (sources: SerializedBriefSource[]) => void;
}) {
  const [handle, setHandle] = useState("");
  const [isAdding, startAdding] = useTransition();
  const [remaining, setRemaining] = useState<number | null>(null);

  const add = () => {
    const clean = handle.trim().replace(/^@/, "");
    if (!clean) return;
    startAdding(async () => {
      const result = await createBriefSourceAction({
        name: clean,
        platform: "INSTAGRAM",
        handleOrUrl: clean,
        category: "REFERENCE",
        priority: true,
      });
      if (result.error || !result.source) {
        toast.error(result.error ?? "No pudimos agregar esa persona.");
        return;
      }
      onSourcesChange([...sources, result.source]);
      setHandle("");
      toast.success(`@${clean} se agregó a tus referentes.`);
    });
  };

  const remove = async (source: SerializedBriefSource) => {
    const result = await deleteBriefSourceAction(source.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onSourcesChange(sources.filter((item) => item.id !== source.id));
    toast.success(
      `@${source.account?.handle ?? source.name} se quitó de tus referentes.`
    );
  };

  const openProfile = async (source: SerializedBriefSource) => {
    if (!delivery.active) {
      toast.error(`Podés ingresar en tu próxima ventana: ${delivery.label}.`);
      return;
    }
    const profileHandle = source.account?.handle;
    if (!profileHandle) {
      toast.error("Ese perfil no tiene un usuario de Instagram válido.");
      return;
    }
    try {
      await openFocusedInstagram(profileHandle);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No pudimos abrir Instagram de forma segura."
      );
      return;
    }
    let seconds = 180;
    setRemaining(seconds);
    const timer = window.setInterval(() => {
      seconds -= 1;
      setRemaining(seconds);
      if (seconds === 15) {
        toast.warning("Quedan 15 segundos. Vas a volver a Mi Círculo.");
      }
      if (seconds <= 0) {
        window.clearInterval(timer);
        setRemaining(null);
        toast("Sesión finalizada. Llegaste al final de este perfil.");
      }
    }, 1000);
  };

  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="Acceso consciente"
        title="Referentes para consultar"
        description="Accedé solamente a los perfiles que elegiste. Cada consulta tiene un máximo de 3 minutos."
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Tu próxima ventana
              </p>
              <p className="mt-1 text-sm text-muted">{delivery.label}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                delivery.active
                  ? "bg-success-dim text-success"
                  : "bg-surface-3 text-muted"
              }`}
            >
              {delivery.active ? "Disponible" : "Cerrado"}
            </span>
          </div>
          {remaining !== null && (
            <div className="mt-5 rounded-lg bg-primary/8 p-4">
              <p className="text-xs text-muted">Tiempo en el perfil</p>
              <p className="mt-1 font-mono text-2xl text-primary">
                {String(Math.floor(remaining / 60)).padStart(2, "0")}:
                {String(remaining % 60).padStart(2, "0")}
              </p>
            </div>
          )}

          <div className="mt-6">
            <label
              htmlFor="circle-instagram-handle"
              className="text-sm font-semibold text-foreground"
            >
              Agregar un referente
            </label>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Escribí el usuario público o privado que ya podés ver desde tu
              cuenta de Instagram.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                id="circle-instagram-handle"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    add();
                  }
                }}
                placeholder="@usuario"
              />
              <Button onClick={add} disabled={isAdding || !handle.trim()}>
                {isAdding ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Agregar
              </Button>
            </div>
            <a
              href="/api/my-brief/focus-extension"
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/8"
            >
              <ShieldCheck size={15} />
              Instalar o actualizar Control.io Focus
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface/45">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-news text-xl text-foreground">
              Referentes seleccionados
            </h2>
            <p className="mt-1 text-xs text-muted">
              {sources.length} {sources.length === 1 ? "referente" : "referentes"}
            </p>
          </div>
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex min-h-20 items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Instagram size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  @{source.account?.handle ?? source.name}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {source.account?.lastSyncedAt
                    ? `Revisado ${timeAgo(source.account.lastSyncedAt)}`
                    : "Aún no comprobado"}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => openProfile(source)}
                disabled={!delivery.active}
              >
                <Clock3 size={15} />
                Abrir 3 min
              </Button>
              <button
                type="button"
                onClick={() => remove(source)}
                aria-label={`Quitar a ${source.name}`}
                className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-danger-dim hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {sources.length === 0 && (
            <QuietEmpty text="Todavía no elegiste referentes. Agregá el primero por su usuario de Instagram." />
          )}
        </div>
      </div>
    </section>
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
  onHarvest: (item: SerializedBriefItem, outcome: "TASK" | "HABIT" | "NOTE") => Promise<void>;
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
}: {
  items: SerializedBriefItem[];
  channelItems: SerializedBriefItem[];
  onOpenItem: (item: SerializedBriefItem) => void;
  onHarvest: (item: SerializedBriefItem, outcome: "TASK" | "HABIT" | "NOTE") => Promise<void>;
  harvested: Set<string>;
  showHarvest: boolean;
  edition: SerializedEdition | null;
  isCompleting: boolean;
  isReopening: boolean;
  onComplete: () => void;
  onReopen: () => void;
}) {
  const groups = topicGroups(items);
  const visibleCount = items.length + channelItems.length;
  const readingMinutes =
    visibleCount === 0
      ? 0
      : Math.max(2, Math.min(6, Math.ceil(visibleCount * 0.45)));

  if (edition?.isRead) {
    return (
      <section className="py-14 text-center" aria-live="polite">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/12 text-success">
          <CheckCircle2 size={24} />
        </span>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-success">
          Edición terminada
        </p>
        <h2 className="mt-2 font-news text-3xl text-foreground">Ya estás al día</h2>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-muted">
          Revisaste {edition.reviewedCount} {edition.reviewedCount === 1 ? "pieza" : "piezas"}.
          No hay nada más para cargar hasta la próxima actualización.
        </p>
        <Button
          variant="secondary"
          onClick={onReopen}
          disabled={isReopening}
          className="mt-6"
        >
          {isReopening && <Loader2 size={16} className="animate-spin" />}
          Volver al contenido de hoy
        </Button>
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
              {visibleCount} {visibleCount === 1 ? "pieza" : "piezas"} · {readingMinutes} min
            </p>
            <p className="mt-1 text-xs text-muted">
              Esta es toda la ración. No se carga contenido infinito al final.
            </p>
          </div>
          <span className="text-xs text-muted">{edition.reviewedCount} revisadas</span>
        </div>
      )}

      {channelItems.length > 0 && (
        <section className="mt-7">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <h2 className="font-news text-2xl text-foreground">De tus referentes</h2>
            <span className="text-xs text-muted">
              {channelItems.length} {channelItems.length === 1 ? "pieza" : "piezas"}
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
          <h2 className="mt-3 font-news text-2xl text-foreground">Llegaste al final</h2>
          <p className="mx-auto mt-2 max-w-[42ch] text-sm leading-relaxed text-muted">
            Lo que servía podía convertirse en tarea, hábito o nota. Lo demás termina acá.
          </p>
          <Button onClick={onComplete} disabled={isCompleting} className="mt-5 w-full sm:w-auto">
            {isCompleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            {isCompleting ? "Cerrando…" : "Terminé por hoy"}
          </Button>
          <p className="mt-3 text-xs text-muted">No vamos a cargar más contenido después de esto.</p>
        </div>
      )}
    </section>
  );
}

function RadarView({ radar }: { radar: SerializedDiscoveryCandidate[] }) {
  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="Panorama general"
        title="Lo que está pasando hoy"
        description="Tres temas en auge de la agenda general, aunque no estén entre tus intereses o referentes."
      />
      <div className="mt-7 overflow-hidden rounded-xl border border-border bg-surface/50 px-4 sm:px-6">
        <TrendTable radar={radar} />
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
        const publishedAt = metadataText(
          trend.signals,
          "latestPublishedAt"
        );
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
}: {
  config: SerializedConfig;
  onSaved: (config: SerializedConfig) => void;
  onBack: () => void;
  fronts: SerializedFront[];
  showSystem: boolean;
  onOpenNorth: () => void;
}) {
  const [topics, setTopics] = useState(config.topics);
  const [topic, setTopic] = useState("");
  const [hours, setHours] = useState(config.sendHours);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(
    config.notifyWhatsapp
  );
  const [isSaving, startSaving] = useTransition();

  const addTopic = () => {
    const clean = topic.trim();
    if (!clean || topics.some((item) => item.toLowerCase() === clean.toLowerCase()))
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
          topics.includes(item)
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
      <div className="mt-7 space-y-8 rounded-xl border border-border bg-surface/55 p-5 sm:p-7">
        {showSystem ? (
          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
            <p className="text-sm font-semibold text-foreground">Los temas salen de El Norte</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Ya no hace falta mantener dos listas. Tus frentes deciden qué entra en la edición.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...new Set(fronts.flatMap((front) => front.topics))].slice(0, 12).map((item) => (
                <span key={item} className="rounded-full bg-surface-2 px-3 py-1.5 text-xs text-foreground">
                  {item}
                </span>
              ))}
              {fronts.length === 0 && (
                <span className="text-xs text-warning">Todavía no definiste ningún frente.</span>
              )}
            </div>
            <Button variant="secondary" onClick={onOpenNorth} className="mt-4">
              <Compass size={16} />
              {fronts.length === 0 ? "Definir mi Norte" : "Revisar mi Norte"}
            </Button>
          </div>
        ) : (
        <div>
          <label htmlFor="circle-topic" className="text-sm font-semibold text-foreground">
            Temas de interés
          </label>
          <p className="mt-1 text-xs text-muted">
            Escribilos libremente. Las noticias mostrarán hasta tres resultados por tema.
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
                  onClick={() => setTopics(topics.filter((value) => value !== item))}
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
            Al comenzar cada ventana se actualiza la edición y se envía el reporte por WhatsApp.
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
              Incluye el enlace directo y los referentes pendientes de consultar.
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

