"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Camera as Instagram,
  Loader2,
  MessageCircle,
  Newspaper,
  Plus,
  Radar,
  RefreshCw,
  Settings2,
  ShieldCheck,
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
  recordBriefItemOpenedAction,
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

type CircleSection = "home" | "instagram" | "news" | "radar" | "settings";

type Props = {
  initialConfig: SerializedConfig;
  initialEditions: SerializedEdition[];
  initialSources: SerializedBriefSource[];
  initialRadar: SerializedDiscoveryCandidate[];
};

const SECTION_LINKS = [
  {
    id: "instagram" as const,
    label: "Referentes",
    description: "Perfiles elegidos, con acceso limitado",
    icon: Instagram,
  },
  {
    id: "news" as const,
    label: "Noticias",
    description: "Hasta 3 noticias verificadas por tema",
    icon: Newspaper,
  },
  {
    id: "radar" as const,
    label: "Radar",
    description: "Los temas que están en auge hoy",
    icon: Radar,
  },
];

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
}: Props) {
  const [section, setSection] = useState<CircleSection>("home");
  const [config, setConfig] = useState(initialConfig);
  const [editions, setEditions] = useState(initialEditions);
  const [sources, setSources] = useState(initialSources);
  const [isGenerating, startGenerating] = useTransition();

  const edition = editions[0] ?? null;
  const items = edition?.items ?? [];
  const newsItems = items.filter((item) => item.kind === "NEWS");
  const instagramSources = sources.filter(
    (source) => source.account?.platform === "INSTAGRAM"
  );
  const delivery = windowState(config.sendHours);

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
    if (edition) {
      recordBriefItemOpenedAction(edition.id, item.url).catch(() => {});
    }
    window.open(item.url, "_blank", "noopener,noreferrer");
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
            Información elegida, en su momento y con un final.
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
            {isGenerating ? "Actualizando…" : "Actualizar"}
          </Button>
        </div>
      </header>

      {section === "home" && (
        <CircleHome
          config={config}
          delivery={delivery}
          edition={edition}
          sources={instagramSources}
          newsItems={newsItems}
          radar={initialRadar}
          onSection={setSection}
          onOpenItem={openItem}
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
        <NewsView items={newsItems} onOpenItem={openItem} />
      )}
      {section === "radar" && (
        <RadarView radar={initialRadar} />
      )}
      {section === "settings" && (
        <CircleSettings
          config={config}
          onSaved={setConfig}
          onBack={() => setSection("home")}
        />
      )}
    </div>
  );
}

function CircleHome({
  config,
  delivery,
  edition,
  sources,
  newsItems,
  radar,
  onSection,
  onOpenItem,
}: {
  config: SerializedConfig;
  delivery: ReturnType<typeof windowState>;
  edition: SerializedEdition | null;
  sources: SerializedBriefSource[];
  newsItems: SerializedBriefItem[];
  radar: SerializedDiscoveryCandidate[];
  onSection: (section: CircleSection) => void;
  onOpenItem: (item: SerializedBriefItem) => void;
}) {
  return (
    <div className="mt-7 space-y-6">
      <section
        aria-label="Estado de hoy"
        className="grid overflow-hidden rounded-xl border border-border bg-surface/70 lg:grid-cols-3"
      >
        <StatusCell
          icon={Instagram}
          label="Próxima ventana de Instagram"
          value={delivery.label}
          detail={`${config.sendHours.length} ${
            config.sendHours.length === 1 ? "ventana configurada" : "ventanas configuradas"
          }`}
        />
        <StatusCell
          icon={MessageCircle}
          label="Reporte de WhatsApp"
          value={config.notifyWhatsapp ? "Activo" : "Desactivado"}
          detail={
            edition
              ? `Última edición ${timeAgo(edition.updatedAt)}`
              : "Se enviará al comenzar la próxima ventana"
          }
        />
        <StatusCell
          icon={CheckCircle2}
          label="Edición de hoy"
          value={edition ? `${edition.reviewedCount} revisados` : "Pendiente"}
          detail={
            edition
              ? `${edition.items.length} contenidos seleccionados`
              : "Todavía no hay una edición"
          }
          last
        />
      </section>

      <nav
        aria-label="Secciones de Mi Círculo"
        className="grid overflow-hidden rounded-xl border border-border md:grid-cols-3"
      >
        {SECTION_LINKS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSection(item.id)}
            className={`flex min-h-24 items-center gap-4 bg-surface/55 px-5 py-4 text-left transition-colors hover:bg-surface-2 focus-visible:z-10 ${
              index < SECTION_LINKS.length - 1
                ? "border-b border-border md:border-b-0 md:border-r"
                : ""
            }`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <item.icon size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-news text-xl text-foreground">
                {item.label}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                {item.description}
              </span>
            </span>
            <ArrowRight size={17} className="ml-auto shrink-0 text-muted" />
          </button>
        ))}
      </nav>

      <section className="grid gap-0 overflow-hidden rounded-xl border border-border bg-surface/45 xl:grid-cols-[0.85fr_1.05fr_1.3fr]">
        <DashboardColumn
          title="Referentes para consultar"
          subtitle="Lista finita de perfiles elegidos"
          action="Consultar referentes"
          onAction={() => onSection("instagram")}
        >
          {sources.slice(0, 5).map((source) => (
            <div
              key={source.id}
              className="flex min-h-16 items-center gap-3 border-b border-border py-3 last:border-b-0"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-3 text-primary">
                <Instagram size={17} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  @{source.account?.handle ?? source.name}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Disponible durante tus ventanas
                </p>
              </div>
            </div>
          ))}
          {sources.length === 0 && (
            <QuietEmpty text="Agregá los referentes que necesitás consultar." />
          )}
        </DashboardColumn>

        <DashboardColumn
          title="Noticias"
          subtitle="Titulares verificados"
          action="Leer noticias"
          onAction={() => onSection("news")}
        >
          {newsItems.slice(0, 3).map((item) => (
            <CompactNews key={item.id} item={item} onOpen={onOpenItem} />
          ))}
          {newsItems.length === 0 && (
            <QuietEmpty text="Tu próxima edición aparecerá en esta columna." />
          )}
        </DashboardColumn>

        <DashboardColumn
          title="Radar"
          subtitle="La agenda general del día"
          action="Abrir Radar"
          onAction={() => onSection("radar")}
          last
        >
          <TrendTable radar={radar} compact />
        </DashboardColumn>
      </section>
    </div>
  );
}

function StatusCell({
  icon: Icon,
  label,
  value,
  detail,
  last = false,
}: {
  icon: typeof Instagram;
  label: string;
  value: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex min-h-32 items-center gap-4 px-5 py-5 ${
        last ? "" : "border-b border-border lg:border-b-0 lg:border-r"
      }`}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/8 text-primary">
        <Icon size={21} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
          {label}
        </p>
        <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
      </div>
    </div>
  );
}

function DashboardColumn({
  title,
  subtitle,
  action,
  onAction,
  children,
  last = false,
}: {
  title: string;
  subtitle: string;
  action: string;
  onAction: () => void;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex min-h-[430px] flex-col px-5 py-5 ${
        last ? "" : "border-b border-border xl:border-b-0 xl:border-r"
      }`}
    >
      <div>
        <h2 className="font-news text-2xl font-medium text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted">{subtitle}</p>
      </div>
      <div className="mt-4 flex-1">{children}</div>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex min-h-11 items-center justify-between border-t border-border pt-4 text-sm font-semibold text-primary"
      >
        {action}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

function CompactNews({
  item,
  onOpen,
}: {
  item: SerializedBriefItem;
  onOpen: (item: SerializedBriefItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="block w-full border-b border-border py-4 text-left last:border-b-0"
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
        {item.topic || "Actualidad"}
      </span>
      <span className="mt-1 block font-news text-lg leading-snug text-foreground">
        {item.title}
      </span>
      <span className="mt-2 block text-xs text-muted">
        {metadataText(item.metadata, "source") || "Fuente verificada"} ·{" "}
        {timeAgo(item.publishedAt)}
      </span>
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

function NewsView({
  items,
  onOpenItem,
}: {
  items: SerializedBriefItem[];
  onOpenItem: (item: SerializedBriefItem) => void;
}) {
  const groups = topicGroups(items);
  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="Edición finita"
        title="Noticias"
        description="Hasta tres noticias por tema, con su fuente y el motivo por el que fueron seleccionadas."
      />
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
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenItem(item)}
                  className="grid w-full gap-3 py-5 text-left md:grid-cols-[2.5rem_1fr_auto]"
                >
                  <span className="font-news text-2xl text-muted-2">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="block font-news text-xl leading-snug text-foreground">
                      {item.title}
                    </span>
                    <span className="mt-2 block max-w-[70ch] text-sm leading-relaxed text-muted">
                      {item.summary}
                    </span>
                    {item.inclusionReason && (
                      <span className="mt-2 block text-xs text-primary">
                        {item.inclusionReason}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted md:justify-end">
                    <ShieldCheck size={14} className="text-success" />
                    {metadataText(item.metadata, "source") || "Fuente verificada"}
                    <ExternalLink size={13} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <QuietEmpty text="Todavía no hay noticias. Agregá temas en Ajustes y actualizá tu edición." />
        )}
      </div>
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
}: {
  config: SerializedConfig;
  onSaved: (config: SerializedConfig) => void;
  onBack: () => void;
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
    if (topics.length === 0) {
      toast.error("Agregá al menos un tema.");
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

function SectionHeading({
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

function QuietEmpty({ text }: { text: string }) {
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
