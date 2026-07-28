"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CirclePause,
  CirclePlay,
  ExternalLink,
  History,
  Lightbulb,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EnablePushInline } from "@/components/push/EnablePushInline";
import {
  createBriefSourceAction,
  deleteBriefSourceAction,
  generateNewsletterNowAction,
  markNewsletterReadAction,
  migrateLegacyBriefSourcesAction,
  reopenBriefEditionAction,
  saveNewsletterConfigAction,
  setBriefSourceActiveAction,
  updateBriefSourceAction,
  updateRadarCandidateAction,
} from "@/app/actions/newsletter";
import type {
  SerializedConfig,
  SerializedEdition,
} from "@/lib/db/newsletter";
import {
  BRIEF_LENGTH_LIMITS,
  RADAR_LIMITS,
  type BriefLength,
  type BriefPlatform,
  type BriefSourceCategory,
  type DiscoveryLevel,
  type SerializedBriefItem,
  type SerializedBriefSource,
  type SerializedDiscoveryCandidate,
} from "@/lib/brief/types";
import { selectBriefSections } from "@/lib/brief/editorial";

type BriefSection = "today" | "sources" | "radar" | "settings";

interface Props {
  initialConfig: SerializedConfig;
  initialEditions: SerializedEdition[];
  initialSources: SerializedBriefSource[];
  initialRadar: SerializedDiscoveryCandidate[];
}

type SourceDraft = {
  name: string;
  platform: BriefPlatform;
  handleOrUrl: string;
  category: BriefSourceCategory;
  priority: boolean;
};

const LEGACY_SOURCE_KEY = "controlio:my-circle:v1";
const BRIEF_CACHE_KEY = "controlio:brief-offline:v1";
const BRIEF_SECTION_KEY = "controlio:brief-section:v1";
const BRIEF_RETURN_KEY = "controlio:brief-return:v1";

const EMPTY_SOURCE: SourceDraft = {
  name: "",
  platform: "INSTAGRAM",
  handleOrUrl: "",
  category: "REFERENCE",
  priority: false,
};

const SECTION_OPTIONS: Array<{
  id: BriefSection;
  label: string;
  icon: typeof Sparkles;
}> = [
  { id: "today", label: "Hoy", icon: Sparkles },
  { id: "sources", label: "Fuentes", icon: UsersRound },
  { id: "radar", label: "Radar", icon: Radar },
  { id: "settings", label: "Ajustes", icon: Settings2 },
];

const PLATFORM_LABELS: Record<BriefPlatform, string> = {
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
  X: "X",
  LINKEDIN: "LinkedIn",
  WEB: "Sitio web",
};

const CATEGORY_LABELS: Record<BriefSourceCategory, string> = {
  CLOSE: "Cercano",
  REFERENCE: "Referente",
  MEDIA: "Medio",
  COMPETITOR: "Competidor",
  INSPIRATION: "Inspiración",
};

const DISCOVERY_COPY: Record<
  DiscoveryLevel,
  { title: string; description: string }
> = {
  CONSERVATIVE: {
    title: "Conservador",
    description: "Como máximo 1 sugerencia y sólo con una señal clara.",
  },
  BALANCED: {
    title: "Equilibrado",
    description: "Hasta 2 sugerencias relevantes, separadas de tus fuentes.",
  },
  EXPLORER: {
    title: "Explorador",
    description: "Hasta 3 sugerencias. El Brief sigue teniendo un final.",
  },
};

const LENGTH_COPY: Record<
  BriefLength,
  { title: string; description: string }
> = {
  SHORT: {
    title: "Breve",
    description: "Hasta 6 contenidos, 2 noticias por tema y 3 publicaciones.",
  },
  NORMAL: {
    title: "Normal",
    description: "Hasta 10 contenidos, 3 noticias por tema y 5 publicaciones.",
  },
  WIDE: {
    title: "Amplio",
    description: "Hasta 15 contenidos, 3 noticias por tema y 8 publicaciones.",
  },
};

function argentinaDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function fullDate(date: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date));
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function updateTime(date: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function timeAgo(iso: string | null): string {
  if (!iso) return "sin fecha";
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "sin fecha";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

function nextDeliveryLabel(hours: number[]): string {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    hour12: false,
  });
  const currentHour = Number(formatter.format(new Date()).slice(0, 2));
  const next = [...hours].sort((a, b) => a - b).find((hour) => hour > currentHour);
  const hour = next ?? [...hours].sort((a, b) => a - b)[0] ?? 8;
  return `${next == null ? "Mañana" : "Hoy"} a las ${String(hour).padStart(2, "0")}:00`;
}

function resizeDeliveryHours(current: number[], count: number): number[] {
  const next = Array.from(new Set(current)).sort((a, b) => a - b);
  for (const suggestion of [8, 12, 18, 21, 15, 10]) {
    if (next.length >= count) break;
    if (!next.includes(suggestion)) next.push(suggestion);
  }
  return next.sort((a, b) => a - b).slice(0, count);
}

function sourceDraft(source: SerializedBriefSource): SourceDraft {
  return {
    name: source.name,
    platform: source.account?.platform ?? "WEB",
    handleOrUrl:
      source.account?.platform === "WEB"
        ? source.account.profileUrl
        : `@${source.account?.handle ?? ""}`,
    category: source.category,
    priority: source.priority,
  };
}

function metadataText(
  metadata: Record<string, unknown> | null,
  key: string
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function validHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function MyBriefClient({
  initialConfig,
  initialEditions,
  initialSources,
  initialRadar,
}: Props) {
  const router = useRouter();
  const [section, setSection] = useState<BriefSection>(
    initialConfig.topics.length ? "today" : "settings"
  );
  const [config, setConfig] = useState(initialConfig);
  const [editions, setEditions] = useState(initialEditions);
  const [sources, setSources] = useState(initialSources);
  const [radar, setRadar] = useState(initialRadar);
  const [isGenerating, startGenerate] = useTransition();
  const [isCompleting, startComplete] = useTransition();
  const [isReopening, startReopen] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(
          BRIEF_SECTION_KEY
        ) as BriefSection | null;
        if (saved && SECTION_OPTIONS.some((option) => option.id === saved)) {
          setSection(saved);
        }
      } catch {
        // La navegación sigue funcionando aunque el almacenamiento esté bloqueado.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(BRIEF_SECTION_KEY, section);
    } catch {
      // no-op
    }
  }, [section]);

  const todayKey = argentinaDateKey(new Date());
  const today =
    editions.find(
      (edition) => argentinaDateKey(new Date(edition.date)) === todayKey
    ) ?? null;
  const history = editions.filter((edition) => edition.id !== today?.id);

  useEffect(() => {
    if (!today) return;
    try {
      localStorage.setItem(
        BRIEF_CACHE_KEY,
        JSON.stringify({
          cachedAt: new Date().toISOString(),
          date: today.date,
          summary: today.summary,
          items: today.items.slice(0, 15),
          isRead: today.isRead,
          reviewedCount: today.reviewedCount,
        })
      );
    } catch {
      // El cache offline es una mejora; la edición en DB sigue siendo la fuente real.
    }
  }, [today]);

  useEffect(() => {
    const restore = () => {
      try {
        const raw = sessionStorage.getItem(BRIEF_RETURN_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as { y?: number; at?: number };
        if (
          typeof saved.y === "number" &&
          typeof saved.at === "number" &&
          Date.now() - saved.at < 30 * 60_000
        ) {
          requestAnimationFrame(() =>
            window.scrollTo({ top: saved.y, behavior: "auto" })
          );
        }
        sessionStorage.removeItem(BRIEF_RETURN_KEY);
      } catch {
        // no-op
      }
    };
    window.addEventListener("pageshow", restore);
    if (document.visibilityState === "visible") restore();
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  useEffect(() => {
    if (config.localSourcesMigrated) return;
    const timer = window.setTimeout(async () => {
      let legacy: unknown = [];
      try {
        const raw = localStorage.getItem(LEGACY_SOURCE_KEY);
        legacy = raw ? JSON.parse(raw) : [];
      } catch {
        toast.error(
          "No pudimos leer tu lista anterior. No se borró ningún dato."
        );
        return;
      }

      const result = await migrateLegacyBriefSourcesAction(legacy);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if ("sources" in result) setSources(result.sources);
      setConfig((current) => ({ ...current, localSourcesMigrated: true }));
      if ("imported" in result && result.imported > 0) {
        toast.success(
          `${result.imported} ${result.imported === 1 ? "fuente migrada" : "fuentes migradas"} desde Mi círculo.`
        );
      }
      try {
        localStorage.removeItem(LEGACY_SOURCE_KEY);
      } catch {
        // Ya está persistido en DB; conservar una copia local no duplica la fuente.
      }
      router.refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [config.localSourcesMigrated, router]);

  const generateNow = () => {
    if (config.topics.length === 0) {
      setSection("settings");
      toast.error("Agregá al menos un tema antes de crear tu Brief.");
      return;
    }
    startGenerate(async () => {
      const result = await generateNewsletterNowAction();
      if (result.error || !result.edition) {
        toast.error(
          result.error ?? "No pudimos actualizar el Brief. Probá de nuevo."
        );
        return;
      }
      setEditions((current) => [
        result.edition!,
        ...current.filter((edition) => edition.id !== result.edition!.id),
      ]);
      setSection("today");
      toast.success(
        result.usedAI
          ? "Mi Brief quedó actualizado y priorizado."
          : "Mi Brief quedó actualizado."
      );
    });
  };

  const completeToday = () => {
    if (!today || today.isRead) return;
    startComplete(async () => {
      const result = await markNewsletterReadAction(today.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const completedAt = new Date().toISOString();
      setEditions((current) =>
        current.map((edition) =>
          edition.id === today.id
            ? { ...edition, isRead: true, completedAt }
            : edition
        )
      );
      toast.success("Listo. Llegaste al final de hoy.");
    });
  };

  const reopenToday = () => {
    if (!today) return;
    startReopen(async () => {
      const result = await reopenBriefEditionAction(today.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setEditions((current) =>
        current.map((edition) =>
          edition.id === today.id
            ? { ...edition, isRead: false, completedAt: null }
            : edition
        )
      );
    });
  };

  const openBriefItem = (edition: SerializedEdition, item: SerializedBriefItem) => {
    if (!validHttpsUrl(item.url)) {
      toast.error("Este contenido no tiene un enlace HTTPS seguro.");
      return;
    }

    try {
      sessionStorage.setItem(
        BRIEF_RETURN_KEY,
        JSON.stringify({ y: window.scrollY, at: Date.now() })
      );
    } catch {
      // no-op
    }

    const alreadyOpened = (() => {
      try {
        const key = `controlio:brief-opened:${edition.id}:${item.contentKey}`;
        if (sessionStorage.getItem(key)) return true;
        sessionStorage.setItem(key, "1");
        return false;
      } catch {
        return false;
      }
    })();
    if (!alreadyOpened) {
      setEditions((current) =>
        current.map((candidate) =>
          candidate.id === edition.id
            ? { ...candidate, reviewedCount: candidate.reviewedCount + 1 }
            : candidate
        )
      );
    }

    void fetch("/api/brief/progress", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editionId: edition.id, url: item.url }),
    }).catch(() => {});
    window.location.assign(item.url);
  };

  const navigate = (next: BriefSection) => {
    setSection(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto w-full max-w-[760px] overflow-x-hidden px-4 pb-8 pt-3 [--text-sm:0.875rem] sm:px-5 md:pb-12 md:pt-7">
      <header className="border-b border-border pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
              Control.io
            </p>
            <h1 className="mt-1 font-news text-[32px] font-medium leading-none text-foreground md:text-[38px]">
              Mi Brief
            </h1>
            <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-muted">
              Lo importante del día, sin perderte en el feed.
            </p>
          </div>
          {section === "today" && (
            <button
              type="button"
              onClick={generateNow}
              disabled={isGenerating}
              aria-label={isGenerating ? "Actualizando Mi Brief" : "Actualizar Mi Brief"}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              <span className="hidden min-[370px]:inline">
                {isGenerating ? "Actualizando" : "Actualizar"}
              </span>
            </button>
          )}
        </div>
      </header>

      <nav
        aria-label="Secciones de Mi Brief"
        className="-mx-4 flex snap-x gap-1 overflow-x-auto border-b border-border px-4 py-2 sm:-mx-5 sm:px-5"
      >
        {SECTION_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = section === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => navigate(option.id)}
              className={`inline-flex min-h-11 min-w-[92px] snap-start items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition-colors min-[390px]:min-w-0 min-[390px]:flex-1 ${
                selected
                  ? "bg-primary text-background"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Icon size={16} />
              {option.label}
            </button>
          );
        })}
      </nav>

      <main className="pt-5">
        {section === "today" && (
          <TodayView
            edition={today}
            config={config}
            sources={sources}
            radar={radar}
            isGenerating={isGenerating}
            isCompleting={isCompleting}
            isReopening={isReopening}
            onGenerate={generateNow}
            onComplete={completeToday}
            onReopen={reopenToday}
            onOpenItem={openBriefItem}
            onNavigate={navigate}
          />
        )}

        {section === "sources" && (
          <SourcesView
            sources={sources}
            onSourcesChange={setSources}
          />
        )}

        {section === "radar" && (
          <RadarView
            candidates={radar}
            onCandidatesChange={setRadar}
            onSourceAdded={(source) =>
              setSources((current) => [source, ...current])
            }
          />
        )}

        {section === "settings" && (
          <SettingsView
            config={config}
            history={history}
            onConfigChange={(nextConfig) => {
              setConfig(nextConfig);
              setRadar((current) =>
                current.slice(0, RADAR_LIMITS[nextConfig.discoveryLevel])
              );
            }}
            onGenerate={generateNow}
            onOpenItem={openBriefItem}
          />
        )}
      </main>
    </div>
  );
}

function TodayView({
  edition,
  config,
  sources,
  radar,
  isGenerating,
  isCompleting,
  isReopening,
  onGenerate,
  onComplete,
  onReopen,
  onOpenItem,
  onNavigate,
}: {
  edition: SerializedEdition | null;
  config: SerializedConfig;
  sources: SerializedBriefSource[];
  radar: SerializedDiscoveryCandidate[];
  isGenerating: boolean;
  isCompleting: boolean;
  isReopening: boolean;
  onGenerate: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onOpenItem: (edition: SerializedEdition, item: SerializedBriefItem) => void;
  onNavigate: (section: BriefSection) => void;
}) {
  if (config.topics.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Armemos tu primer Brief"
        description="Elegí los temas que te importan y, si querés, agregá personas o medios. Después vas a recibir una edición corta y con final."
        action="Configurar mis temas"
        onAction={() => onNavigate("settings")}
      />
    );
  }

  if (!edition) {
    return (
      <EmptyState
        icon={Newspaper}
        title="Todavía no hay una edición para hoy"
        description="Tus temas ya están guardados. Podés crear el Brief ahora o esperar la próxima hora programada."
        action={isGenerating ? "Creando el Brief…" : "Crear Mi Brief"}
        onAction={onGenerate}
        disabled={isGenerating}
      />
    );
  }

  if (edition.isRead) {
    return (
      <section className="py-8 text-center" aria-live="polite">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/12 text-success">
          <CheckCircle2 size={24} />
        </span>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-success">
          Edición terminada
        </p>
        <h2 className="mt-2 font-news text-3xl font-medium text-foreground">
          Ya estás al día
        </h2>
        <p className="mx-auto mt-3 max-w-[42ch] text-sm leading-relaxed text-muted">
          Revisaste {edition.reviewedCount}{" "}
          {edition.reviewedCount === 1 ? "contenido" : "contenidos"}. No hay nada
          más para cargar. Próxima actualización:{" "}
          {nextDeliveryLabel(config.sendHours).toLowerCase()}.
        </p>
        <button
          type="button"
          onClick={onReopen}
          disabled={isReopening}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-surface-2 disabled:opacity-50"
        >
          {isReopening && <Loader2 size={16} className="animate-spin" />}
          Volver al contenido de hoy
        </button>
      </section>
    );
  }

  const selection = selectBriefSections(edition.items, config.briefLength);
  const keys = selection.keys;
  const socialItems = selection.social;
  const topicGroups = selection.topics;
  const visibleCount =
    keys.length +
    socialItems.length +
    topicGroups.reduce((sum, group) => sum + group.items.length, 0) +
    radar.length;
  const readingMinutes = Math.max(2, Math.min(5, Math.ceil(visibleCount * 0.45)));

  return (
    <div className="space-y-9">
      <section aria-labelledby="today-status">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <p id="today-status" className="capitalize text-foreground">
            {fullDate(edition.date)}
          </p>
          <span aria-hidden="true">·</span>
          <span>Actualizado {updateTime(edition.updatedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{readingMinutes} min de lectura</span>
        </div>
      </section>

      <section aria-labelledby="brief-summary">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          En 30 segundos
        </p>
        <h2 id="brief-summary" className="sr-only">
          Resumen general
        </h2>
        <p className="mt-3 max-w-[62ch] font-news text-[21px] leading-[1.5] text-foreground sm:text-[23px]">
          {edition.summary}
        </p>
      </section>

      <EditorialSection
        eyebrow="Prioridad"
        title="Las claves de hoy"
        description="Hasta tres piezas para entender qué importa."
      >
        {keys.length > 0 ? (
          <div className="divide-y divide-border border-y border-border">
            {keys.map((item) => (
              <BriefItemRow
                key={item.id}
                item={item}
                onOpen={() => onOpenItem(edition, item)}
              />
            ))}
          </div>
        ) : (
          <InlineEmpty text="Hoy no encontramos claves suficientemente sólidas para destacar." />
        )}
      </EditorialSection>

      <EditorialSection
        eyebrow="Elegidas por vos"
        title="De tus fuentes"
        description="Publicaciones recientes de las personas y cuentas que agregaste."
        action={
          <button
            type="button"
            onClick={() => onNavigate("sources")}
            className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/8"
          >
            Administrar
          </button>
        }
      >
        {socialItems.length > 0 ? (
          <div className="divide-y divide-border border-y border-border">
            {socialItems.map((item) => (
              <BriefItemRow
                key={item.id}
                item={item}
                onOpen={() => onOpenItem(edition, item)}
              />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <InlineEmpty
            text="Todavía no agregaste fuentes. Sumá personas o medios y aparecerán acá cuando haya contenido disponible."
            action="Agregar una fuente"
            onAction={() => onNavigate("sources")}
          />
        ) : (
          <InlineEmpty
            text="No llegaron publicaciones verificables de tus fuentes en esta edición. Podés abrir sus perfiles desde Fuentes; las noticias siguen disponibles."
            action="Ver mis fuentes"
            onAction={() => onNavigate("sources")}
          />
        )}
      </EditorialSection>

      <EditorialSection
        eyebrow="Noticias"
        title="Tus temas"
        description={`Una selección finita: hasta ${BRIEF_LENGTH_LIMITS[config.briefLength].perTopic} noticias por tema.`}
      >
        {topicGroups.length > 0 ? (
          <div className="space-y-7">
            {topicGroups.map((group) => (
              <div key={group.topic}>
                <h3 className="mb-1 text-sm font-semibold text-foreground">
                  {group.topic}
                </h3>
                <div className="divide-y divide-border border-y border-border">
                  {group.items.map((item) => (
                    <BriefItemRow
                      key={item.id}
                      item={item}
                      compact
                      onOpen={() => onOpenItem(edition, item)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <InlineEmpty text="No encontramos más noticias confiables para tus temas hoy." />
        )}
      </EditorialSection>

      <EditorialSection
        eyebrow="Descubrimiento limitado"
        title="Radar del día"
        description="Sugerencias explicadas y separadas de las fuentes que elegiste."
        action={
          <button
            type="button"
            onClick={() => onNavigate("radar")}
            className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/8"
          >
            Ver Radar
          </button>
        }
      >
        {radar.length > 0 ? (
          <div className="space-y-3">
            {radar.slice(0, 2).map((candidate) => (
              <div
                key={candidate.id}
                className="rounded-xl border border-border bg-surface px-4 py-4"
              >
                <p className="text-sm font-semibold text-foreground">
                  {candidate.sourceName}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {candidate.explanation}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <InlineEmpty text="Hoy no encontramos nuevas fuentes que valga la pena sumar." />
        )}
      </EditorialSection>

      <section
        className="border-t border-border pb-3 pt-7 text-center"
        aria-labelledby="edition-end"
      >
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-success/12 text-success">
          <Check size={20} />
        </span>
        <h2
          id="edition-end"
          className="mt-3 font-news text-2xl font-medium text-foreground"
        >
          Llegaste al final
        </h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-sm leading-relaxed text-muted">
          Revisaste {edition.reviewedCount}{" "}
          {edition.reviewedCount === 1 ? "contenido" : "contenidos"}. Próxima
          actualización: {nextDeliveryLabel(config.sendHours).toLowerCase()}.
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
      </section>
    </div>
  );
}

function EditorialSection({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted">
            {eyebrow}
          </p>
          <h2 className="mt-1 font-news text-[25px] font-medium leading-tight text-foreground">
            {title}
          </h2>
        </div>
        {action}
      </div>
      <p className="mb-4 mt-1 text-sm leading-relaxed text-muted">
        {description}
      </p>
      {children}
    </section>
  );
}

function BriefItemRow({
  item,
  compact = false,
  onOpen,
}: {
  item: SerializedBriefItem;
  compact?: boolean;
  onOpen: () => void;
}) {
  const source =
    metadataText(item.metadata, "source") ??
    metadataText(item.metadata, "author") ??
    item.sourceType;
  const handle = metadataText(item.metadata, "handle");
  const thumbnail = metadataText(item.metadata, "thumbnailUrl");
  const isSocial = item.kind === "SOCIAL";

  return (
    <article className={compact ? "py-4" : "py-5"}>
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="font-semibold uppercase tracking-[0.08em] text-primary">
              {isSocial ? item.sourceType : "Noticia"}
            </span>
            {item.topic && (
              <>
                <span aria-hidden="true">·</span>
                <span>{item.topic}</span>
              </>
            )}
          </div>
          <h3
            className={`mt-2 text-foreground ${
              compact
                ? "text-[15px] font-semibold leading-snug"
                : "font-news text-xl font-medium leading-snug"
            }`}
          >
            {item.title}
          </h3>
          {item.summary && item.summary !== item.title && (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {item.summary}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="font-medium text-foreground">{source}</span>
            {handle && <span>@{handle}</span>}
            <span aria-hidden="true">·</span>
            <span>{timeAgo(item.publishedAt)}</span>
          </div>
          {item.inclusionReason && (
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
              <Lightbulb size={13} className="mt-0.5 shrink-0 text-warning" />
              {item.inclusionReason}
            </p>
          )}
        </div>
        {thumbnail && (
          // El proveedor entrega una URL HTTPS validada. Evitamos next/image
          // porque las plataformas admitidas no tienen un host fijo.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            className="h-20 w-24 shrink-0 rounded-lg border border-border object-cover"
          />
        )}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 pr-3 text-sm font-semibold text-primary hover:bg-primary/8"
      >
        {isSocial ? "Abrir publicación" : "Abrir noticia"}
        <ArrowUpRight size={15} />
      </button>
    </article>
  );
}

function SourcesView({
  sources,
  onSourcesChange,
}: {
  sources: SerializedBriefSource[];
  onSourcesChange: React.Dispatch<
    React.SetStateAction<SerializedBriefSource[]>
  >;
}) {
  const [adding, setAdding] = useState(sources.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sources;
    return sources.filter(
      (source) =>
        source.name.toLowerCase().includes(normalized) ||
        source.account?.handle.toLowerCase().includes(normalized) ||
        PLATFORM_LABELS[source.account?.platform ?? "WEB"]
          .toLowerCase()
          .includes(normalized)
    );
  }, [query, sources]);

  const pause = async (source: SerializedBriefSource) => {
    if (busyId) return;
    setBusyId(source.id);
    const result = await setBriefSourceActiveAction(source.id, !source.isActive);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onSourcesChange((current) =>
      current.map((candidate) =>
        candidate.id === source.id
          ? { ...candidate, isActive: !source.isActive }
          : candidate
      )
    );
    toast.success(source.isActive ? "Fuente pausada." : "Fuente reactivada.");
  };

  const remove = async (source: SerializedBriefSource) => {
    if (
      !window.confirm(
        `¿Eliminar ${source.name} de tus fuentes? Las ediciones anteriores se conservan.`
      )
    ) {
      return;
    }
    if (busyId) return;
    setBusyId(source.id);
    const result = await deleteBriefSourceAction(source.id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onSourcesChange((current) =>
      current.filter((candidate) => candidate.id !== source.id)
    );
    toast.success("Fuente eliminada.");
  };

  const openProfile = (source: SerializedBriefSource) => {
    const url = source.account?.profileUrl;
    if (!url || !validHttpsUrl(url)) {
      toast.error("Esta fuente no tiene un enlace HTTPS válido.");
      return;
    }
    window.location.assign(url);
  };

  return (
    <section aria-labelledby="sources-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted">
            Elegidas por vos
          </p>
          <h2
            id="sources-title"
            className="mt-1 font-news text-3xl font-medium text-foreground"
          >
            Fuentes
          </h2>
          <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted">
            Personas, medios y cuentas que querés seguir sin reconstruir un feed
            infinito.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="Agregar una fuente"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-background"
          >
            <Plus size={16} />
            <span className="hidden min-[370px]:inline">Agregar</span>
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">
              Agregar una fuente
            </h3>
            {sources.length > 0 && (
              <button
                type="button"
                aria-label="Cancelar"
                onClick={() => setAdding(false)}
                className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <SourceForm
            initial={EMPTY_SOURCE}
            submitLabel="Agregar a mis fuentes"
            onCancel={sources.length ? () => setAdding(false) : undefined}
            onSubmit={async (draft) => {
              const result = await createBriefSourceAction(draft);
              if (result.error || !result.source) return result.error ?? "Error";
              onSourcesChange((current) => [result.source!, ...current]);
              setAdding(false);
              toast.success("Fuente agregada.");
              return null;
            }}
          />
        </div>
      )}

      {sources.length >= 8 && (
        <label className="relative mt-6 block">
          <span className="sr-only">Buscar en mis fuentes</span>
          <Search
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, handle o plataforma"
            className="pl-10 text-[16px]"
            type="search"
            enterKeyHint="search"
          />
        </label>
      )}

      <div className="mt-6 space-y-3">
        {filtered.map((source) => (
          <article
            key={source.id}
            className={`rounded-xl border p-4 ${
              source.isActive
                ? "border-border bg-surface"
                : "border-border bg-surface-2/45"
            }`}
          >
            {editingId === source.id ? (
              <>
                <h3 className="mb-4 text-base font-semibold text-foreground">
                  Editar fuente
                </h3>
                <SourceForm
                  initial={sourceDraft(source)}
                  submitLabel="Guardar cambios"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (draft) => {
                    const result = await updateBriefSourceAction(
                      source.id,
                      draft
                    );
                    if (result.error || !result.source) {
                      return result.error ?? "Error";
                    }
                    onSourcesChange((current) =>
                      current.map((candidate) =>
                        candidate.id === source.id
                          ? result.source!
                          : candidate
                      )
                    );
                    setEditingId(null);
                    toast.success("Fuente actualizada.");
                    return null;
                  }}
                />
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-base font-semibold text-foreground">
                        {source.name}
                      </h3>
                      {source.priority && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-2 py-1 text-xs font-semibold text-warning">
                          <Star size={12} fill="currentColor" />
                          Prioridad
                        </span>
                      )}
                      {!source.isActive && (
                        <span className="rounded-full bg-surface-3 px-2 py-1 text-xs font-semibold text-muted">
                          Pausada
                        </span>
                      )}
                    </div>
                    <p className="mt-1 break-all text-sm text-muted">
                      {source.account
                        ? `${PLATFORM_LABELS[source.account.platform]} · @${source.account.handle}`
                        : "Sin cuenta vinculada"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {CATEGORY_LABELS[source.category]}
                      {source.account?.status === "PRIVATE" && " · Cuenta privada"}
                      {source.account?.status === "NOT_FOUND" &&
                        " · Cuenta no encontrada"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => openProfile(source)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-surface-2"
                  >
                    <ExternalLink size={15} />
                    Abrir perfil
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(source.id)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-surface-2"
                  >
                    <Pencil size={15} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void pause(source)}
                    disabled={busyId === source.id}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-surface-2 disabled:opacity-50"
                  >
                    {busyId === source.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : source.isActive ? (
                      <CirclePause size={15} />
                    ) : (
                      <CirclePlay size={15} />
                    )}
                    {source.isActive ? "Pausar" : "Reactivar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(source)}
                    disabled={busyId === source.id}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-danger hover:bg-danger/8 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>

      {!adding && filtered.length === 0 && (
        <InlineEmpty
          text={
            query
              ? "No encontramos fuentes con esa búsqueda."
              : "Todavía no agregaste ninguna fuente."
          }
        />
      )}

      <div className="mt-6 rounded-xl bg-surface-2 px-4 py-4 text-sm leading-relaxed text-muted">
        <p className="font-semibold text-foreground">Sobre el contenido social</p>
        <p className="mt-1">
          Control.io sólo muestra publicaciones cuando la plataforma o un
          proveedor autorizado entrega datos verificables. Si no puede hacerlo,
          vas a poder abrir el perfil o la publicación por HTTPS desde el
          celular. La extensión de escritorio es opcional.
        </p>
      </div>
    </section>
  );
}

function SourceForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: SourceDraft;
  submitLabel: string;
  onSubmit: (draft: SourceDraft) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const idPrefix = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const nextError = await onSubmit(draft);
      if (nextError) {
        setError(nextError);
        requestAnimationFrame(() => errorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }));
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && (
        <p
          ref={errorRef}
          role="alert"
          className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <div>
        <label htmlFor={`${idPrefix}-name`} className="mb-1.5 block text-sm font-medium text-foreground">
          Nombre para reconocerla
        </label>
        <Input
          id={`${idPrefix}-name`}
          value={draft.name}
          onChange={(event) =>
            setDraft((current) => ({ ...current, name: event.target.value }))
          }
          placeholder="Ejemplo: Franco Pisso"
          autoComplete="off"
          enterKeyHint="next"
          className="text-[16px]"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-platform`} className="mb-1.5 block text-sm font-medium text-foreground">
            Plataforma
          </label>
          <Select
            id={`${idPrefix}-platform`}
            value={draft.platform}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                platform: event.target.value as BriefPlatform,
              }))
            }
            className="text-[16px]"
          >
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-category`} className="mb-1.5 block text-sm font-medium text-foreground">
            Tipo de relación
          </label>
          <Select
            id={`${idPrefix}-category`}
            value={draft.category}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value as BriefSourceCategory,
              }))
            }
            className="text-[16px]"
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-handle`} className="mb-1.5 block text-sm font-medium text-foreground">
          Handle o URL
        </label>
        <Input
          id={`${idPrefix}-handle`}
          value={draft.handleOrUrl}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              handleOrUrl: event.target.value,
            }))
          }
          placeholder={
            draft.platform === "WEB"
              ? "https://ejemplo.com"
              : "@usuario o https://…"
          }
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className="text-[16px]"
          required
        />
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Podés pegar el enlace completo desde la app de la plataforma.
        </p>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2">
        <input
          type="checkbox"
          checked={draft.priority}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              priority: event.target.checked,
            }))
          }
          className="h-5 w-5 accent-primary"
        />
        <span>
          <span className="block text-sm font-semibold text-foreground">
            Marcar como prioridad
          </span>
          <span className="block text-xs text-muted">
            Sus contenidos se consideran antes, sin aumentar el límite.
          </span>
        </span>
      </label>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="min-h-11 rounded-lg px-4 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-foreground"
          >
            Cancelar
          </button>
        )}
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          {isPending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function RadarView({
  candidates,
  onCandidatesChange,
  onSourceAdded,
}: {
  candidates: SerializedDiscoveryCandidate[];
  onCandidatesChange: React.Dispatch<
    React.SetStateAction<SerializedDiscoveryCandidate[]>
  >;
  onSourceAdded: (source: SerializedBriefSource) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = async (
    candidate: SerializedDiscoveryCandidate,
    action: "ADD" | "TODAY_ONLY" | "DISMISS"
  ) => {
    if (busyId) return;
    setBusyId(candidate.id);
    const result = await updateRadarCandidateAction(candidate.id, action);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onCandidatesChange((current) =>
      action === "TODAY_ONLY"
        ? current.map((item) =>
            item.id === candidate.id
              ? { ...item, status: "TODAY_ONLY" }
              : item
          )
        : current.filter((item) => item.id !== candidate.id)
    );
    if (result.source) onSourceAdded(result.source);
    toast.success(
      action === "ADD"
        ? "Fuente agregada."
        : action === "DISMISS"
          ? "No volveremos a priorizar esta sugerencia."
          : "La conservamos sólo para la edición de hoy."
    );
  };

  return (
    <section aria-labelledby="radar-title">
      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted">
        Descubrimiento limitado
      </p>
      <h2
        id="radar-title"
        className="mt-1 font-news text-3xl font-medium text-foreground"
      >
        Radar del día
      </h2>
      <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-muted">
        Pocas sugerencias, con una razón visible. Nunca se encadenan con otras
        recomendaciones.
      </p>

      {candidates.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="Hoy no encontramos nuevas fuentes que valga la pena sumar"
          description="Preferimos dejar este espacio vacío antes que inventar métricas o mostrar recomendaciones débiles."
        />
      ) : (
        <div className="mt-6 space-y-4">
          {candidates.map((candidate) => (
            <article
              key={candidate.id}
              className="rounded-xl border border-border bg-surface p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {candidate.platform && (
                  <span className="font-semibold uppercase tracking-[0.08em] text-primary">
                    {PLATFORM_LABELS[candidate.platform]}
                  </span>
                )}
                {candidate.topic && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{candidate.topic}</span>
                  </>
                )}
              </div>
              <h3 className="mt-2 font-news text-xl font-medium text-foreground">
                {candidate.sourceName}
              </h3>
              {candidate.status === "TODAY_ONLY" && (
                <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  Visible sólo hoy
                </span>
              )}
              {candidate.handle && (
                <p className="mt-1 break-all text-sm text-muted">
                  @{candidate.handle}
                </p>
              )}
              <p className="mt-3 text-sm leading-relaxed text-foreground">
                {candidate.explanation}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {candidate.status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void act(candidate, "ADD")}
                      disabled={busyId === candidate.id}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-background disabled:opacity-50"
                    >
                      {busyId === candidate.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Plus size={15} />
                      )}
                      Agregar a mis fuentes
                    </button>
                    <button
                      type="button"
                      onClick={() => void act(candidate, "TODAY_ONLY")}
                      disabled={busyId === candidate.id}
                      className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-surface-2 disabled:opacity-50"
                    >
                      Mostrar sólo hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => void act(candidate, "DISMISS")}
                      disabled={busyId === candidate.id}
                      className="min-h-11 rounded-lg px-4 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
                    >
                      No me interesa
                    </button>
                  </>
                )}
                {validHttpsUrl(candidate.profileUrl) && (
                  <a
                    href={candidate.profileUrl}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-primary hover:bg-primary/8"
                  >
                    Abrir
                    <ArrowUpRight size={15} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SettingsView({
  config,
  history,
  onConfigChange,
  onGenerate,
  onOpenItem,
}: {
  config: SerializedConfig;
  history: SerializedEdition[];
  onConfigChange: (config: SerializedConfig) => void;
  onGenerate: () => void;
  onOpenItem: (edition: SerializedEdition, item: SerializedBriefItem) => void;
}) {
  const [topics, setTopics] = useState(config.topics);
  const [priorityTopics, setPriorityTopics] = useState(config.priorityTopics);
  const [topicInput, setTopicInput] = useState("");
  const [isActive, setIsActive] = useState(config.isActive);
  const [sendHours, setSendHours] = useState(config.sendHours);
  const [notifyPush, setNotifyPush] = useState(config.notifyPush);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(config.notifyWhatsapp);
  const [discoveryLevel, setDiscoveryLevel] =
    useState<DiscoveryLevel>(config.discoveryLevel);
  const [briefLength, setBriefLength] =
    useState<BriefLength>(config.briefLength);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedEdition, setExpandedEdition] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const dirty =
    JSON.stringify(topics) !== JSON.stringify(config.topics) ||
    JSON.stringify(priorityTopics) !==
      JSON.stringify(config.priorityTopics) ||
    JSON.stringify(sendHours) !== JSON.stringify(config.sendHours) ||
    isActive !== config.isActive ||
    notifyPush !== config.notifyPush ||
    notifyWhatsapp !== config.notifyWhatsapp ||
    discoveryLevel !== config.discoveryLevel ||
    briefLength !== config.briefLength;

  const addTopic = () => {
    const topic = topicInput.trim();
    if (!topic) return;
    if (topics.some((item) => item.toLowerCase() === topic.toLowerCase())) {
      setTopicInput("");
      return;
    }
    if (topics.length >= 12) {
      toast.error("Podés seguir hasta 12 temas.");
      return;
    }
    setTopics((current) => [...current, topic]);
    setTopicInput("");
  };

  const save = () => {
    startSave(async () => {
      const result = await saveNewsletterConfigAction({
        topics,
        priorityTopics,
        language: config.language,
        country: config.country,
        isActive,
        sendHour: sendHours[0],
        sendHours,
        notifyOnReady: notifyPush || notifyWhatsapp,
        notifyPush,
        notifyWhatsapp,
        discoveryLevel,
        briefLength,
      });
      if (result.error || !result.config) {
        toast.error(result.error ?? "No pudimos guardar los ajustes.");
        return;
      }
      onConfigChange(result.config);
      setTopics(result.config.topics);
      setPriorityTopics(result.config.priorityTopics);
      setSendHours(result.config.sendHours);
      toast.success("Ajustes guardados.");
    });
  };

  return (
    <section aria-labelledby="settings-title">
      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted">
        Tu edición
      </p>
      <h2
        id="settings-title"
        className="mt-1 font-news text-3xl font-medium text-foreground"
      >
        Ajustes
      </h2>
      <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-muted">
        Definí qué entra, cuándo se prepara y cuánto querés leer.
      </p>

      <div className="mt-7 space-y-9">
        <SettingsBlock
          title="Temas y prioridades"
          description="La estrella indica lo que el sistema debe considerar primero."
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addTopic();
            }}
            className="flex gap-2"
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="brief-topic" className="sr-only">
                Nuevo tema
              </label>
              <Input
                id="brief-topic"
                value={topicInput}
                onChange={(event) => setTopicInput(event.target.value)}
                placeholder="Ejemplo: inteligencia artificial"
                className="text-[16px]"
                enterKeyHint="done"
              />
            </div>
            <Button
              type="submit"
              size="icon"
              aria-label="Agregar tema"
              disabled={!topicInput.trim()}
            >
              <Plus size={18} />
            </Button>
          </form>

          <div className="mt-4 space-y-2">
            {topics.map((topic) => {
              const prioritized = priorityTopics.includes(topic);
              return (
                <div
                  key={topic}
                  className="flex min-h-12 items-center gap-2 rounded-lg border border-border px-2"
                >
                  <button
                    type="button"
                    aria-label={
                      prioritized
                        ? `Quitar prioridad a ${topic}`
                        : `Marcar ${topic} como prioritario`
                    }
                    onClick={() =>
                      setPriorityTopics((current) =>
                        current.includes(topic)
                          ? current.filter((item) => item !== topic)
                          : [...current, topic]
                      )
                    }
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${
                      prioritized ? "text-warning" : "text-muted"
                    }`}
                  >
                    <Star
                      size={17}
                      fill={prioritized ? "currentColor" : "none"}
                    />
                  </button>
                  <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">
                    {topic}
                  </span>
                  <button
                    type="button"
                    aria-label={`Eliminar ${topic}`}
                    onClick={() => {
                      setTopics((current) =>
                        current.filter((item) => item !== topic)
                      );
                      setPriorityTopics((current) =>
                        current.filter((item) => item !== topic)
                      );
                    }}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/8 hover:text-danger"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
            {topics.length === 0 && (
              <InlineEmpty text="Agregá al menos un tema para poder generar tu Brief." />
            )}
          </div>
        </SettingsBlock>

        <SettingsBlock
          title="Preparación automática"
          description="Podés recibir entre una y tres actualizaciones por día, siempre con contenido finito."
        >
          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border px-3">
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Preparar automáticamente
              </span>
              <span className="block text-xs text-muted">
                Usa la zona horaria de Argentina.
              </span>
            </span>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-5 w-5 accent-primary"
            />
          </label>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-foreground">
              Actualizaciones diarias
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={sendHours.length === count}
                  onClick={() =>
                    setSendHours((current) =>
                      resizeDeliveryHours(current, count)
                    )
                  }
                  className={`min-h-11 rounded-lg border text-sm font-semibold ${
                    sendHours.length === count
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:bg-surface-2"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 space-y-3">
            {sendHours.map((hour, index) => (
              <div key={`${index}-${hour}`}>
                <label
                  htmlFor={`delivery-hour-${index}`}
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Horario {index + 1}
                </label>
                <Select
                  id={`delivery-hour-${index}`}
                  value={hour}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (
                      sendHours.some(
                        (candidate, candidateIndex) =>
                          candidateIndex !== index && candidate === value
                      )
                    ) {
                      toast.error("Elegí horarios distintos.");
                      return;
                    }
                    setSendHours((current) => {
                      const next = [...current];
                      next[index] = value;
                      return next.sort((a, b) => a - b);
                    });
                  }}
                  className="text-[16px]"
                >
                  {Array.from({ length: 24 }, (_, value) => (
                    <option key={value} value={value}>
                      {String(value).padStart(2, "0")}:00
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </SettingsBlock>

        <SettingsBlock
          title="Notificaciones"
          description="Elegí cómo querés enterarte cuando la edición esté lista."
        >
          <div className="space-y-2">
            <ToggleRow
              title="Push en este dispositivo"
              description="Disponible según el navegador y el sistema operativo."
              checked={notifyPush}
              onChange={setNotifyPush}
            />
            {notifyPush && (
              <div className="rounded-lg bg-surface-2 px-3 py-3">
                <EnablePushInline />
              </div>
            )}
            <ToggleRow
              title="WhatsApp"
              description="Usa el número vinculado en tu cuenta."
              checked={notifyWhatsapp}
              onChange={setNotifyWhatsapp}
            />
            {notifyWhatsapp && (
              <p className="px-1 text-xs leading-relaxed text-muted">
                Si todavía no vinculaste un número, podés hacerlo desde{" "}
                <Link href="/configuracion" className="font-semibold text-primary">
                  Configuración
                </Link>
                .
              </p>
            )}
          </div>
        </SettingsBlock>

        <SettingsBlock
          title="Nivel de descubrimiento"
          description="El Radar nunca se mezcla con las fuentes que elegiste."
        >
          <ChoiceList
            value={discoveryLevel}
            options={DISCOVERY_COPY}
            onChange={setDiscoveryLevel}
          />
        </SettingsBlock>

        <SettingsBlock
          title="Longitud del Brief"
          description="Los tres modos tienen un límite concreto y no cargan páginas adicionales."
        >
          <ChoiceList
            value={briefLength}
            options={LENGTH_COPY}
            onChange={setBriefLength}
          />
        </SettingsBlock>

        <SettingsBlock
          title="Historial"
          description="Tus ediciones anteriores siguen disponibles."
        >
          <button
            type="button"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((current) => !current)}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-border px-3 text-left text-sm font-semibold text-foreground hover:bg-surface-2"
          >
            <span className="flex items-center gap-2">
              <History size={16} />
              Ver {history.length}{" "}
              {history.length === 1 ? "edición anterior" : "ediciones anteriores"}
            </span>
            {historyOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>

          {historyOpen && (
            <div className="mt-3 divide-y divide-border border-y border-border">
              {history.map((edition) => {
                const expanded = expandedEdition === edition.id;
                return (
                  <div key={edition.id}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedEdition(expanded ? null : edition.id)
                      }
                      className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-foreground">
                          {shortDate(edition.date)}
                        </span>
                        <span className="block text-xs text-muted">
                          {edition.items.length} contenidos
                          {edition.isRead ? " · terminada" : ""}
                        </span>
                      </span>
                      {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                    </button>
                    {expanded && (
                      <div className="pb-4">
                        <p className="mb-2 text-sm leading-relaxed text-muted">
                          {edition.summary}
                        </p>
                        {edition.items.slice(0, 6).map((item) => (
                          <BriefItemRow
                            key={item.id}
                            item={item}
                            compact
                            onOpen={() => onOpenItem(edition, item)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {history.length === 0 && (
                <InlineEmpty text="El historial va a aparecer después de tu primera edición." />
              )}
            </div>
          )}
        </SettingsBlock>
      </div>

      <div
        className="sticky z-10 -mx-4 mt-8 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:-mx-5 sm:px-5 md:static md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none"
        style={{
          bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <Button
          onClick={save}
          disabled={!dirty || isSaving || topics.length === 0}
          className="w-full"
        >
          {isSaving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}
          {isSaving
            ? "Guardando…"
            : dirty
              ? "Guardar ajustes"
              : "Todo guardado"}
        </Button>
        {dirty && topics.length > 0 && (
          <p className="mt-2 text-center text-xs text-muted">
            Guardá antes de crear una nueva edición.
          </p>
        )}
      </div>

      {config.topics.length > 0 && !dirty && (
        <button
          type="button"
          onClick={onGenerate}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-primary hover:bg-primary/8"
        >
          <RefreshCw size={16} />
          Actualizar Mi Brief ahora
        </button>
      )}
    </section>
  );
}

function SettingsBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
      <span>
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="block text-xs leading-relaxed text-muted">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 accent-primary"
      />
    </label>
  );
}

function ChoiceList<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Record<T, { title: string; description: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      {(Object.entries(options) as Array<
        [T, { title: string; description: string }]
      >).map(([key, option]) => (
        <label
          key={key}
          className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 ${
            value === key
              ? "border-primary bg-primary/8"
              : "border-border"
          }`}
        >
          <input
            type="radio"
            checked={value === key}
            onChange={() => onChange(key)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
          />
          <span>
            <span className="block text-sm font-semibold text-foreground">
              {option.title}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              {option.description}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
  disabled,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="py-10 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon size={21} />
      </span>
      <h2 className="mx-auto mt-4 max-w-[28ch] font-news text-2xl font-medium text-foreground">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-[48ch] text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action && onAction && (
        <Button
          onClick={onAction}
          disabled={disabled}
          className="mt-5 w-full sm:w-auto"
        >
          {disabled && <Loader2 size={16} className="animate-spin" />}
          {action}
        </Button>
      )}
    </div>
  );
}

function InlineEmpty({
  text,
  action,
  onAction,
}: {
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-4">
      <p className="text-sm leading-relaxed text-muted">{text}</p>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 min-h-11 rounded-lg pr-3 text-sm font-semibold text-primary"
        >
          {action}
        </button>
      )}
    </div>
  );
}
