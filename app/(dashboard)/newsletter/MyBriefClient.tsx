"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import Script from "next/script";
import {
  BadgeCheck,
  Bell,
  BookOpenCheck,
  Check,
  ChevronDown,
  CircleUserRound,
  Clock3,
  ExternalLink,
  History,
  MessageCircle,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EnablePushInline } from "@/components/push/EnablePushInline";
import { formatDateLong } from "@/lib/utils";
import {
  generateNewsletterNowAction,
  markNewsletterReadAction,
  saveNewsletterConfigAction,
} from "@/app/actions/newsletter";
import type { SerializedConfig, SerializedEdition } from "@/lib/db/newsletter";
import type { AnalyzedArticle } from "@/lib/services/newsletter-ai";

interface Props {
  initialConfig: SerializedConfig;
  initialEditions: SerializedEdition[];
}

type BriefTab = "today" | "circle" | "preferences" | "history";

type CirclePerson = {
  id: string;
  name: string;
  handle: string;
  kind: "familiar" | "referente";
};

type InstagramWindow = Window & {
  instgrm?: { Embeds?: { process: () => void } };
};

const CIRCLE_STORAGE_KEY = "controlio:my-circle:v1";

const TABS: Array<{
  id: BriefTab;
  label: string;
  icon: typeof Sparkles;
}> = [
  { id: "today", label: "Hoy", icon: Sparkles },
  { id: "circle", label: "Mi círculo", icon: CircleUserRound },
  { id: "preferences", label: "Ajustes", icon: Settings2 },
  { id: "history", label: "Historial", icon: History },
];

function processInstagramEmbeds() {
  window.setTimeout(() => {
    (window as InstagramWindow).instgrm?.Embeds?.process();
  }, 0);
}

function normalizeInstagramHandle(value: string): string | null {
  const normalized = value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();

  if (!/^[a-zA-Z0-9._]{1,30}$/.test(normalized)) return null;
  return normalized;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "";
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

function dateline(date: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function argentinaDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function selectBriefArticles(articles: AnalyzedArticle[], limit = 8) {
  const highlights = articles
    .filter((article) => article.highlight)
    .sort((a, b) => Number(b.priority) - Number(a.priority))
    .slice(0, 3);
  const essentials = highlights.length > 0 ? highlights : articles.slice(0, 3);
  const selectedUrls = new Set(essentials.map((article) => article.url));
  const remaining = articles
    .filter((article) => !selectedUrls.has(article.url))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      return a.rank - b.rank;
    })
    .slice(0, Math.max(0, limit - essentials.length));
  return { essentials, remaining };
}

export function MyBriefClient({ initialConfig, initialEditions }: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [editions, setEditions] = useState(initialEditions);
  const [activeTab, setActiveTab] = useState<BriefTab>(
    initialConfig.topics.length > 0 ? "today" : "preferences"
  );

  const [topics, setTopics] = useState(initialConfig.topics);
  const [priority, setPriority] = useState(initialConfig.priorityTopics);
  const [isActive, setIsActive] = useState(initialConfig.isActive);
  const [sendHour, setSendHour] = useState(initialConfig.sendHour);
  const [notifyPush, setNotifyPush] = useState(initialConfig.notifyPush);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(
    initialConfig.notifyWhatsapp
  );
  const [topicInput, setTopicInput] = useState("");

  const [circlePeople, setCirclePeople] = useState<CirclePerson[]>([]);
  const [circleHydrated, setCircleHydrated] = useState(false);
  const [circleName, setCircleName] = useState("");
  const [circleHandle, setCircleHandle] = useState("");
  const [circleKind, setCircleKind] =
    useState<CirclePerson["kind"]>("familiar");

  const [expandedEdition, setExpandedEdition] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isGenerating, startGenerate] = useTransition();
  const [isCompleting, startComplete] = useTransition();

  const todayKey = argentinaDateKey(new Date());
  const today =
    editions.find(
      (edition) => argentinaDateKey(new Date(edition.date)) === todayKey
    ) ?? null;
  const history = editions.filter((edition) => edition.id !== today?.id);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(CIRCLE_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as CirclePerson[];
          if (Array.isArray(parsed)) setCirclePeople(parsed.slice(0, 20));
        }
      } catch {
        toast.error("No pudimos recuperar tu círculo en este dispositivo.");
      } finally {
        setCircleHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!circleHydrated) return;
    window.localStorage.setItem(
      CIRCLE_STORAGE_KEY,
      JSON.stringify(circlePeople)
    );
    if (activeTab === "circle" && circlePeople.length > 0) {
      processInstagramEmbeds();
    }
  }, [activeTab, circleHydrated, circlePeople]);

  const dirty = useMemo(
    () =>
      JSON.stringify(topics) !== JSON.stringify(config.topics) ||
      JSON.stringify(priority) !==
        JSON.stringify(config.priorityTopics) ||
      isActive !== config.isActive ||
      sendHour !== config.sendHour ||
      notifyPush !== config.notifyPush ||
      notifyWhatsapp !== config.notifyWhatsapp,
    [
      topics,
      priority,
      isActive,
      sendHour,
      notifyPush,
      notifyWhatsapp,
      config,
    ]
  );

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

  const removeTopic = (topic: string) => {
    setTopics((current) => current.filter((item) => item !== topic));
    setPriority((current) => current.filter((item) => item !== topic));
  };

  const togglePriority = (topic: string) => {
    setPriority((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic]
    );
  };

  const saveConfig = () => {
    startSave(async () => {
      const result = await saveNewsletterConfigAction({
        topics,
        priorityTopics: priority,
        language: config.language,
        country: config.country,
        isActive,
        sendHour,
        notifyOnReady: notifyPush || notifyWhatsapp,
        notifyPush,
        notifyWhatsapp,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.success && result.config) {
        setConfig(result.config);
        setTopics(result.config.topics);
        setPriority(result.config.priorityTopics);
        setIsActive(result.config.isActive);
        setSendHour(result.config.sendHour);
        setNotifyPush(result.config.notifyPush);
        setNotifyWhatsapp(result.config.notifyWhatsapp);
        toast.success("Preferencias guardadas.");
      }
    });
  };

  const generateNow = () => {
    if (topics.length === 0) {
      toast.error("Agregá al menos un tema.");
      setActiveTab("preferences");
      return;
    }
    if (dirty) {
      toast.error("Guardá tus preferencias antes de generar.");
      setActiveTab("preferences");
      return;
    }

    startGenerate(async () => {
      const result = await generateNewsletterNowAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.success && result.edition) {
        setEditions((current) => [
          result.edition!,
          ...current.filter((edition) => edition.id !== result.edition!.id),
        ]);
        setActiveTab("today");
        toast.success(
          result.usedAI
            ? `Brief listo: ${result.count} noticias analizadas.`
            : `Brief listo: ${result.count} noticias.`
        );
      }
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
      setEditions((current) =>
        current.map((edition) =>
          edition.id === today.id ? { ...edition, isRead: true } : edition
        )
      );
      toast.success("Listo. Ya estás al día.");
    });
  };

  const addCirclePerson = () => {
    const handle = normalizeInstagramHandle(circleHandle);
    if (!handle) {
      toast.error("Ingresá un usuario válido, por ejemplo @usuario.");
      return;
    }
    if (
      circlePeople.some(
        (person) => person.handle.toLowerCase() === handle.toLowerCase()
      )
    ) {
      toast.error("Ese perfil ya está en tu círculo.");
      return;
    }
    if (circlePeople.length >= 20) {
      toast.error("Tu círculo admite hasta 20 perfiles en esta versión.");
      return;
    }

    setCirclePeople((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: circleName.trim() || `@${handle}`,
        handle,
        kind: circleKind,
      },
    ]);
    setCircleName("");
    setCircleHandle("");
    toast.success("Perfil agregado a tu círculo.");
  };

  const removeCirclePerson = (personId: string) => {
    setCirclePeople((current) =>
      current.filter((person) => person.id !== personId)
    );
    toast.success("Perfil quitado de este dispositivo.");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 overflow-x-hidden px-4">
      <header className="space-y-5 pt-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
              Control.io
            </p>
            <h1 className="mt-1.5 font-news text-[32px] font-medium leading-none text-foreground md:text-[38px]">
              Mi Brief
            </h1>
            <p className="mt-2.5 max-w-[52ch] text-sm leading-relaxed text-muted">
              Lo importante del día, con un final claro.
            </p>
          </div>

          {activeTab === "today" && (
            <Button
              variant="secondary"
              onClick={generateNow}
              disabled={isGenerating}
              aria-label={
                isGenerating ? "Generando el brief" : "Actualizar el brief"
              }
            >
              <RefreshCw
                size={16}
                className={isGenerating ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">
                {isGenerating ? "Generando…" : "Actualizar"}
              </span>
            </Button>
          )}
        </div>

        <nav
          className="grid grid-cols-4 gap-1 pb-1"
          aria-label="Secciones de Mi Brief"
          role="tablist"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:gap-2 sm:px-3 sm:text-sm ${
                  selected
                    ? "bg-primary text-background"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {activeTab === "today" && (
        <TodayBrief
          edition={today}
          topicsConfigured={topics.length > 0}
          isGenerating={isGenerating}
          isCompleting={isCompleting}
          onGenerate={generateNow}
          onConfigure={() => setActiveTab("preferences")}
          onComplete={completeToday}
          nextHour={sendHour}
        />
      )}

      {activeTab === "circle" && (
        <CircleView
          people={circlePeople}
          hydrated={circleHydrated}
          name={circleName}
          handle={circleHandle}
          kind={circleKind}
          onNameChange={setCircleName}
          onHandleChange={setCircleHandle}
          onKindChange={setCircleKind}
          onAdd={addCirclePerson}
          onRemove={removeCirclePerson}
          onEmbedsReady={processInstagramEmbeds}
        />
      )}

      {activeTab === "preferences" && (
        <PreferencesView
          topics={topics}
          priority={priority}
          topicInput={topicInput}
          isActive={isActive}
          sendHour={sendHour}
          notifyPush={notifyPush}
          notifyWhatsapp={notifyWhatsapp}
          dirty={dirty}
          isSaving={isSaving}
          onTopicInputChange={setTopicInput}
          onAddTopic={addTopic}
          onRemoveTopic={removeTopic}
          onTogglePriority={togglePriority}
          onActiveChange={setIsActive}
          onSendHourChange={setSendHour}
          onNotifyPushChange={setNotifyPush}
          onNotifyWhatsappChange={setNotifyWhatsapp}
          onSave={saveConfig}
        />
      )}

      {activeTab === "history" && (
        <HistoryView
          editions={history}
          expanded={expandedEdition}
          onToggle={setExpandedEdition}
        />
      )}
    </div>
  );
}

function TodayBrief({
  edition,
  topicsConfigured,
  isGenerating,
  isCompleting,
  onGenerate,
  onConfigure,
  onComplete,
  nextHour,
}: {
  edition: SerializedEdition | null;
  topicsConfigured: boolean;
  isGenerating: boolean;
  isCompleting: boolean;
  onGenerate: () => void;
  onConfigure: () => void;
  onComplete: () => void;
  nextHour: number;
}) {
  if (!edition) {
    return (
      <section className="rounded-2xl border border-border bg-surface px-5 py-10 text-center sm:px-8">
        <Sparkles size={28} className="mx-auto text-primary" />
        <h2 className="mt-4 text-xl font-bold text-foreground">
          Tu primera edición empieza acá
        </h2>
        <p className="mx-auto mt-2 max-w-[44ch] text-sm leading-relaxed text-muted">
          {topicsConfigured
            ? "Generá el brief de hoy y quedate solamente con lo que merece tu atención."
            : "Elegí tus temas para recibir una edición breve y personalizada cada día."}
        </p>
        <Button
          className="mt-6"
          onClick={topicsConfigured ? onGenerate : onConfigure}
          disabled={isGenerating}
        >
          {topicsConfigured ? "Generar el brief de hoy" : "Elegir mis temas"}
        </Button>
      </section>
    );
  }

  const { essentials, remaining } = selectBriefArticles(edition.articles);
  const visibleCount = essentials.length + remaining.length;
  const estimatedMinutes = Math.max(3, Math.ceil(visibleCount * 0.7));

  if (edition.isRead) {
    return (
      <section className="rounded-2xl border border-success/25 bg-success/5 px-5 py-10 text-center sm:px-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
          <Check size={24} />
        </span>
        <h2 className="mt-4 text-xl font-bold text-foreground">
          Ya estás al día
        </h2>
        <p className="mt-2 text-sm text-muted">
          Tu próxima edición se prepara mañana a las{" "}
          {String(nextHour).padStart(2, "0")}:00.
        </p>
      </section>
    );
  }

  return (
    <article className="space-y-9">
      <header className="animate-news-in">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            {dateline(edition.date)}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={13} />
              {estimatedMinutes} min
            </span>
            <span>{visibleCount} contenidos</span>
          </div>
        </div>

        {edition.summary && (
          <div className="mt-5">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              En pocas palabras
            </p>
            <p className="font-news text-[20px] leading-[1.55] text-foreground md:text-[23px]">
              {edition.summary}
            </p>
          </div>
        )}
      </header>

      {essentials.length > 0 && (
        <BriefSection title="Lo imprescindible" articles={essentials} lead />
      )}

      {remaining.length > 0 && (
        <BriefSection title="Tus temas" articles={remaining} />
      )}

      {visibleCount === 0 && (
        <p className="text-sm text-muted">
          Hoy no encontramos noticias confiables para tus temas.
        </p>
      )}

      <div className="space-y-4 border-t border-border pt-6 text-center">
        <p className="text-sm text-muted">
          Cuando terminás, el brief termina con vos.
        </p>
        <Button onClick={onComplete} disabled={isCompleting}>
          <BookOpenCheck size={17} />
          {isCompleting ? "Cerrando edición…" : "Terminé por hoy"}
        </Button>
      </div>

      <SourceNotice />
    </article>
  );
}

function BriefSection({
  title,
  articles,
  lead = false,
}: {
  title: string;
  articles: AnalyzedArticle[];
  lead?: boolean;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-foreground">
          {title}
        </h2>
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[11px] text-muted">
          {articles.length}
        </span>
      </div>
      <div className="divide-y divide-border">
        {articles.map((article, index) => (
          <BriefStory
            key={`${article.url}-${index}`}
            article={article}
            lead={lead && index === 0}
          />
        ))}
      </div>
    </section>
  );
}

function BriefStory({
  article,
  lead = false,
}: {
  article: AnalyzedArticle;
  lead?: boolean;
}) {
  const ago = timeAgo(article.publishedAt);
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block py-5 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
          {article.topic}
        </span>
        {article.priority && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-warning">
            prioritario
          </span>
        )}
      </div>
      <h3
        className={`font-news font-medium leading-tight text-foreground transition-colors group-hover:text-primary ${
          lead ? "text-[24px] md:text-[28px]" : "text-[19px] md:text-[21px]"
        }`}
      >
        {article.title}
      </h3>
      {article.summary && (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {article.summary}
        </p>
      )}
      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted">
        <span className="font-medium text-foreground/70">{article.source}</span>
        {article.reputable && (
          <BadgeCheck
            size={13}
            className="shrink-0 text-success/80"
            aria-label="Fuente reconocida"
          />
        )}
        {ago && (
          <>
            <span aria-hidden="true">·</span>
            <span>{ago}</span>
          </>
        )}
        <ExternalLink size={13} className="ml-0.5 text-primary" />
      </div>
    </a>
  );
}

function SourceNotice() {
  return (
    <p className="flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted">
      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success/80" />
      <span>
        Priorizamos fuentes reconocidas y filtramos contenido dudoso. Verificá
        la fuente original antes de compartir.
      </span>
    </p>
  );
}

function CircleView({
  people,
  hydrated,
  name,
  handle,
  kind,
  onNameChange,
  onHandleChange,
  onKindChange,
  onAdd,
  onRemove,
  onEmbedsReady,
}: {
  people: CirclePerson[];
  hydrated: boolean;
  name: string;
  handle: string;
  kind: CirclePerson["kind"];
  onNameChange: (value: string) => void;
  onHandleChange: (value: string) => void;
  onKindChange: (value: CirclePerson["kind"]) => void;
  onAdd: () => void;
  onRemove: (personId: string) => void;
  onEmbedsReady: () => void;
}) {
  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground">Mi círculo</h2>
        <p className="mt-1 max-w-[58ch] text-sm leading-relaxed text-muted">
          Elegí familiares y referentes. Instagram mostrará el perfil dentro de
          Control.io solamente cuando sea público y permita inserciones.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-bold text-foreground">Agregar un perfil</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-foreground">
            Nombre para reconocerlo
            <Input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Ejemplo: Mamá"
              maxLength={60}
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-foreground">
            Usuario de Instagram
            <Input
              value={handle}
              onChange={(event) => onHandleChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onAdd();
                }
              }}
              placeholder="@usuario"
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={120}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="space-y-1.5 text-sm font-medium text-foreground">
            Tipo de vínculo
            <Select
              value={kind}
              onChange={(event) =>
                onKindChange(event.target.value as CirclePerson["kind"])
              }
              className="min-w-44"
            >
              <option value="familiar">Familiar o amistad</option>
              <option value="referente">Referente</option>
            </Select>
          </label>
          <Button onClick={onAdd}>
            <Plus size={16} />
            Agregar a Mi círculo
          </Button>
        </div>
      </div>

      {!hydrated ? (
        <div className="space-y-3" aria-label="Cargando Mi círculo">
          <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
          <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
        </div>
      ) : people.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
          <CircleUserRound size={28} className="mx-auto text-primary" />
          <h3 className="mt-4 text-lg font-bold text-foreground">
            Tu círculo está vacío
          </h3>
          <p className="mx-auto mt-2 max-w-[42ch] text-sm leading-relaxed text-muted">
            Agregá un perfil público para probar cómo se muestra su contenido
            permitido por Instagram.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {people.map((person) => (
            <article key={person.id} className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-foreground">
                    {person.name}
                  </h3>
                  <p className="text-sm text-muted">
                    @{person.handle} ·{" "}
                    {person.kind === "familiar" ? "tu círculo" : "referente"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(person.id)}
                  aria-label={`Quitar a ${person.name} de Mi círculo`}
                  title="Quitar de Mi círculo"
                >
                  <Trash2 size={17} />
                </Button>
              </div>

              <div className="mx-auto min-h-32 max-w-[540px] overflow-hidden rounded-xl bg-surface-2">
                <blockquote
                  className="instagram-media !m-0 !min-w-0 !max-w-[540px] !w-full"
                  data-instgrm-permalink={`https://www.instagram.com/${person.handle}/`}
                  data-instgrm-version="14"
                  style={
                    {
                      width: "100%",
                      minWidth: 0,
                      margin: 0,
                    } as CSSProperties
                  }
                >
                  <div className="flex min-h-32 flex-col items-center justify-center gap-3 p-5 text-center">
                    <p className="text-sm text-muted">
                      Cargando el perfil público de @{person.handle}…
                    </p>
                    <a
                      href={`https://www.instagram.com/${person.handle}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      Verificar perfil en Instagram
                    </a>
                  </div>
                </blockquote>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-surface-2 p-4 text-xs leading-relaxed text-muted">
        <p className="font-semibold text-foreground">Límite de esta versión</p>
        <p className="mt-1">
          Las cuentas privadas, las historias y los perfiles que desactivaron
          las inserciones no pueden mostrarse fuera de Instagram. La lista se
          guarda solamente en este navegador y no modifica tu base de datos.
        </p>
      </div>

      {people.length > 0 && (
        <Script
          id="instagram-embed"
          src="https://www.instagram.com/embed.js"
          strategy="lazyOnload"
          onReady={onEmbedsReady}
          onError={() =>
            toast.error(
              "Instagram no pudo cargar los perfiles. Podés reintentar más tarde."
            )
          }
        />
      )}
    </section>
  );
}

function PreferencesView({
  topics,
  priority,
  topicInput,
  isActive,
  sendHour,
  notifyPush,
  notifyWhatsapp,
  dirty,
  isSaving,
  onTopicInputChange,
  onAddTopic,
  onRemoveTopic,
  onTogglePriority,
  onActiveChange,
  onSendHourChange,
  onNotifyPushChange,
  onNotifyWhatsappChange,
  onSave,
}: {
  topics: string[];
  priority: string[];
  topicInput: string;
  isActive: boolean;
  sendHour: number;
  notifyPush: boolean;
  notifyWhatsapp: boolean;
  dirty: boolean;
  isSaving: boolean;
  onTopicInputChange: (value: string) => void;
  onAddTopic: () => void;
  onRemoveTopic: (topic: string) => void;
  onTogglePriority: (topic: string) => void;
  onActiveChange: (value: boolean) => void;
  onSendHourChange: (value: number) => void;
  onNotifyPushChange: (value: boolean) => void;
  onNotifyWhatsappChange: (value: boolean) => void;
  onSave: () => void;
}) {
  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground">Preferencias</h2>
        <p className="mt-1 text-sm text-muted">
          Cinco temas bien elegidos suelen ser suficientes para un brief útil.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Temas que querés seguir
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Marcá con una estrella lo verdaderamente prioritario.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={topicInput}
            onChange={(event) => onTopicInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddTopic();
              }
            }}
            placeholder="Ejemplo: inteligencia artificial"
          />
          <Button
            variant="secondary"
            size="icon"
            onClick={onAddTopic}
            aria-label="Agregar tema"
          >
            <Plus size={17} />
          </Button>
        </div>

        {topics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => {
              const isPriority = priority.includes(topic);
              return (
                <span
                  key={topic}
                  className={`inline-flex min-h-11 max-w-full items-center gap-1 rounded-full border py-1 pl-1 pr-2 text-sm ${
                    isPriority
                      ? "border-warning/30 bg-warning/10"
                      : "border-transparent bg-surface-2"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onTogglePriority(topic)}
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    aria-label={
                      isPriority
                        ? `Quitar prioridad a ${topic}`
                        : `Priorizar ${topic}`
                    }
                  >
                    <Star
                      size={14}
                      className={
                        isPriority
                          ? "fill-warning text-warning"
                          : "text-muted"
                      }
                    />
                  </button>
                  <span className="min-w-0 break-words px-0.5">{topic}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveTopic(topic)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    aria-label={`Quitar ${topic}`}
                  >
                    <X size={15} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => onActiveChange(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
          />
          <span>
            <span className="font-semibold">Preparar una edición cada día</span>
            <span className="mt-0.5 block text-xs text-muted">
              Se genera automáticamente a la hora que elijas.
            </span>
          </span>
        </label>

        {isActive && (
          <label className="flex flex-wrap items-center gap-2 text-sm text-foreground">
            <Clock3 size={15} className="text-muted" />
            Hora de entrega
            <Select
              value={String(sendHour)}
              onChange={(event) =>
                onSendHourChange(Number(event.target.value))
              }
              className="w-24"
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </Select>
            <span className="text-xs text-muted">Argentina</span>
          </label>
        )}
      </div>

      {isActive && (
        <div className="space-y-4 border-t border-border pt-6">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Bell size={15} className="text-primary" />
              Avisarme una sola vez
            </h3>
            <p className="mt-1 text-xs text-muted">
              Elegí por dónde querés recibir el aviso diario.
            </p>
          </div>

          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={notifyPush}
              onChange={(event) => onNotifyPushChange(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="font-semibold">Notificación push</span>
              <span className="mt-0.5 block text-xs text-muted">
                En el celular o navegador.
              </span>
            </span>
          </label>
          {notifyPush && <EnablePushInline />}

          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={notifyWhatsapp}
              onChange={(event) =>
                onNotifyWhatsappChange(event.target.checked)
              }
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="flex items-center gap-1.5 font-semibold">
                <MessageCircle size={14} className="text-primary" />
                WhatsApp
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Recibís el resumen en el número vinculado.
              </span>
            </span>
          </label>
        </div>
      )}

      <div className="flex justify-end border-t border-border pt-6">
        <Button onClick={onSave} disabled={isSaving || !dirty}>
          {isSaving ? "Guardando preferencias…" : "Guardar preferencias"}
        </Button>
      </div>
    </section>
  );
}

function HistoryView({
  editions,
  expanded,
  onToggle,
}: {
  editions: SerializedEdition[];
  expanded: string | null;
  onToggle: (editionId: string | null) => void;
}) {
  if (editions.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
        <History size={28} className="mx-auto text-primary" />
        <h2 className="mt-4 text-lg font-bold text-foreground">
          Todavía no hay ediciones anteriores
        </h2>
        <p className="mt-2 text-sm text-muted">
          Tus briefs anteriores van a quedar disponibles acá.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Historial</h2>
        <p className="mt-1 text-sm text-muted">
          Volvé a una edición solamente cuando estés buscando algo concreto.
        </p>
      </div>
      {editions.map((edition) => {
        const isExpanded = expanded === edition.id;
        return (
          <div key={edition.id} className="border-b border-border">
            <button
              type="button"
              className="flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              onClick={() => onToggle(isExpanded ? null : edition.id)}
              aria-expanded={isExpanded}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold capitalize text-foreground">
                  {formatDateLong(edition.date)}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-muted">
                  {edition.summary}
                </p>
              </div>
              <ChevronDown
                size={18}
                className={`shrink-0 text-muted transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
            {isExpanded && (
              <div className="pb-7">
                <BriefSection
                  title="Contenido de la edición"
                  articles={edition.articles}
                />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
