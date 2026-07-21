"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { toast } from "sonner";
import {
  Plus,
  X,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Settings2,
  Star,
  ChevronDown,
  Clock,
  Bell,
  BadgeCheck,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { EnablePushInline } from "@/components/push/EnablePushInline";
import { formatDateLong } from "@/lib/utils";
import {
  saveNewsletterConfigAction,
  generateNewsletterNowAction,
  markNewsletterReadAction,
} from "@/app/actions/newsletter";
import type { SerializedConfig, SerializedEdition } from "@/lib/db/newsletter";
import type { AnalyzedArticle } from "@/lib/services/newsletter-ai";

interface Props {
  initialConfig: SerializedConfig;
  initialEditions: SerializedEdition[];
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export function NewsletterClient({ initialConfig, initialEditions }: Props) {
  const [config, setConfig] = useState<SerializedConfig>(initialConfig);
  const [editions, setEditions] = useState<SerializedEdition[]>(initialEditions);

  // Borrador editable (se compara con `config` para saber si hay cambios).
  const [topics, setTopics] = useState<string[]>(initialConfig.topics);
  const [priority, setPriority] = useState<string[]>(initialConfig.priorityTopics);
  const [isActive, setIsActive] = useState<boolean>(initialConfig.isActive);
  const [sendHour, setSendHour] = useState<number>(initialConfig.sendHour);
  const [notifyOnReady, setNotifyOnReady] = useState<boolean>(
    initialConfig.notifyOnReady
  );
  const [topicInput, setTopicInput] = useState("");

  const [showConfig, setShowConfig] = useState(initialConfig.topics.length === 0);
  const [isSaving, startSave] = useTransition();
  const [isGenerating, startGenerate] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);

  const today = editions[0] ?? null;
  const history = editions.slice(1);

  // Marcar la edición de hoy como leída al entrar (apaga el badge del menú).
  const markedRef = useRef(false);
  useEffect(() => {
    if (markedRef.current) return;
    if (today && !today.isRead) {
      markedRef.current = true;
      markNewsletterReadAction(today.id).catch(() => {});
    }
  }, [today]);

  const dirty = useMemo(
    () =>
      JSON.stringify(topics) !== JSON.stringify(config.topics) ||
      JSON.stringify(priority) !== JSON.stringify(config.priorityTopics) ||
      isActive !== config.isActive ||
      sendHour !== config.sendHour ||
      notifyOnReady !== config.notifyOnReady,
    [topics, priority, isActive, sendHour, notifyOnReady, config]
  );

  const addTopic = () => {
    const t = topicInput.trim();
    if (!t) return;
    if (topics.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setTopicInput("");
      return;
    }
    if (topics.length >= 12) {
      toast.error("Máximo 12 temas");
      return;
    }
    setTopics((prev) => [...prev, t]);
    setTopicInput("");
  };

  const removeTopic = (t: string) => {
    setTopics((prev) => prev.filter((x) => x !== t));
    setPriority((prev) => prev.filter((x) => x !== t));
  };

  const togglePriority = (t: string) =>
    setPriority((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const saveConfig = () => {
    startSave(async () => {
      const res = await saveNewsletterConfigAction({
        topics,
        priorityTopics: priority,
        language: config.language,
        country: config.country,
        isActive,
        sendHour,
        notifyOnReady,
      });
      if (res.error) toast.error(res.error);
      else if (res.success && res.config) {
        setConfig(res.config);
        setTopics(res.config.topics);
        setPriority(res.config.priorityTopics);
        setIsActive(res.config.isActive);
        setSendHour(res.config.sendHour);
        setNotifyOnReady(res.config.notifyOnReady);
        toast.success("Preferencias guardadas");
      }
    });
  };

  const generateNow = () => {
    if (topics.length === 0) {
      toast.error("Agregá al menos un tema");
      setShowConfig(true);
      return;
    }
    if (dirty) {
      toast.error("Guardá tus cambios antes de generar");
      return;
    }
    startGenerate(async () => {
      const res = await generateNewsletterNowAction();
      if (res.error) toast.error(res.error);
      else if (res.success && res.edition) {
        markedRef.current = true; // ya la estamos viendo
        setEditions((prev) => {
          const rest = prev.filter((e) => e.id !== res.edition!.id);
          return [{ ...res.edition!, isRead: true }, ...rest];
        });
        toast.success(
          res.usedAI
            ? `Edición lista · ${res.count} noticias analizadas con IA`
            : `Edición lista · ${res.count} noticias`
        );
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto pb-24 px-4 space-y-6">
      {/* Nameplate editorial */}
      <header className="pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
              Control.io
            </p>
            <h1 className="font-news font-medium text-foreground text-[32px] md:text-[38px] leading-none mt-1.5">
              Newsletter
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setShowConfig((v) => !v)}
              title="Configurar temas y horario"
            >
              <Settings2 size={18} />
            </Button>
            <Button onClick={generateNow} disabled={isGenerating}>
              <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
              <span className="hidden sm:inline">
                {isGenerating ? "Generando…" : "Generar ahora"}
              </span>
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted mt-2.5">
          Tu edición diaria de noticias, filtrada por tus temas.
        </p>
      </header>

      {/* Config de temas + preferencias */}
      {showConfig && (
        <Card>
          <CardContent className="pt-5 space-y-5">
            {/* Temas */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">
                Temas que te interesan
              </p>
              <p className="text-xs text-muted mb-3 leading-relaxed">
                Ej: “inteligencia artificial”, “dólar Argentina”, “Boca Juniors”.
                Tocá la{" "}
                <Star size={11} className="inline -mt-0.5 text-warning" /> de un
                tema para marcarlo <span className="text-warning">prioritario</span>:
                la IA lo pondera primero al elegir lo sobresaliente del día.
              </p>
              <div className="flex gap-2">
                <Input
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTopic();
                    }
                  }}
                  placeholder="Agregar un tema…"
                />
                <Button variant="secondary" onClick={addTopic}>
                  <Plus size={16} />
                </Button>
              </div>
              {topics.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {topics.map((t) => {
                    const isPrio = priority.includes(t);
                    return (
                      <span
                        key={t}
                        className={`inline-flex items-center gap-1 rounded-full pl-1 pr-1.5 py-1 text-sm border transition-colors ${
                          isPrio
                            ? "bg-warning/10 border-warning/30 text-foreground"
                            : "bg-surface-2 border-transparent text-foreground"
                        }`}
                      >
                        <button
                          onClick={() => togglePriority(t)}
                          className="rounded-full p-1 hover:bg-surface-3 transition-colors"
                          aria-label={
                            isPrio ? `Quitar prioridad a ${t}` : `Priorizar ${t}`
                          }
                          title={isPrio ? "Prioritario" : "Marcar prioritario"}
                        >
                          <Star
                            size={13}
                            className={
                              isPrio
                                ? "text-warning fill-warning"
                                : "text-muted"
                            }
                          />
                        </button>
                        <span className="px-0.5">{t}</span>
                        <button
                          onClick={() => removeTopic(t)}
                          className="rounded-full p-0.5 hover:bg-surface-3 text-muted hover:text-foreground transition-colors"
                          aria-label={`Quitar ${t}`}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Automático + horario */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-3.5 space-y-3">
              <label className="flex items-start gap-2.5 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 mt-0.5 accent-primary shrink-0"
                />
                <span className="leading-snug">
                  <span className="flex items-center gap-1.5 font-medium">
                    <RefreshCw size={13} className="text-primary" />
                    Generar mi edición automáticamente todos los días
                  </span>
                  <span className="text-xs text-muted">
                    A la hora que elijas armamos tu edición sola, con IA.
                  </span>
                </span>
              </label>

              {isActive && (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pl-6">
                  <Clock size={14} className="text-muted shrink-0" />
                  <span className="text-sm text-foreground">A las</span>
                  <Select
                    value={String(sendHour)}
                    onChange={(e) => setSendHour(Number(e.target.value))}
                    className="h-9 w-24"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </Select>
                  <span className="text-xs text-muted">(hora Argentina)</span>
                </div>
              )}
            </div>

            {/* Recordatorio: el aviso que te trae de vuelta a leerla */}
            {isActive && (
              <div className="rounded-xl border border-border bg-surface-2/40 p-3.5 space-y-3">
                <label className="flex items-start gap-2.5 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnReady}
                    onChange={(e) => setNotifyOnReady(e.target.checked)}
                    className="h-4 w-4 mt-0.5 accent-primary shrink-0"
                  />
                  <span className="leading-snug">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Bell size={13} className="text-primary" />
                      Recordarme con una notificación cuando esté lista
                    </span>
                    <span className="text-xs text-muted">
                      Un push al celular (y WhatsApp si lo tenés vinculado) que te
                      lleva directo a leerla. Así no te olvidás de entrar.
                    </span>
                  </span>
                </label>

                {notifyOnReady && (
                  <div className="pl-6">
                    <EnablePushInline />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={saveConfig} disabled={isSaving || !dirty}>
                {isSaving ? "Guardando…" : "Guardar preferencias"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edición de hoy */}
      {today ? (
        <EditionView edition={today} isToday />
      ) : (
        <EmptyState
          icon={Sparkles}
          title="Todavía no hay ninguna edición"
          description={
            topics.length === 0
              ? "Agregá tus temas de interés y generá tu primera edición."
              : "Tocá “Generar ahora” para armar la edición de hoy."
          }
          action={
            <Button
              onClick={
                topics.length === 0 ? () => setShowConfig(true) : generateNow
              }
              disabled={isGenerating}
            >
              {topics.length === 0 ? "Configurar temas" : "Generar ahora"}
            </Button>
          }
        />
      )}

      {/* Historial */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-[0.08em] px-1">
            Ediciones anteriores
          </h2>
          {history.map((ed) => (
            <Card key={ed.id}>
              <button
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => setExpanded((x) => (x === ed.id ? null : ed.id))}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {formatDateLong(ed.date)}
                  </p>
                  <p className="text-xs text-muted line-clamp-1">{ed.summary}</p>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-muted shrink-0 ml-3 transition-transform ${
                    expanded === ed.id ? "rotate-180" : ""
                  }`}
                />
              </button>
              {expanded === ed.id && (
                <div className="px-4 pb-4">
                  <EditionView edition={ed} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

type TopicGroup = {
  topic: string;
  priority: boolean;
  items: AnalyzedArticle[];
};

/** Agrupa por tema conservando el orden, con tope de 3 por tema. */
function groupByTopic(articles: AnalyzedArticle[]): TopicGroup[] {
  const map = new Map<string, AnalyzedArticle[]>();
  for (const a of articles) {
    const arr = map.get(a.topic) ?? [];
    if (arr.length < 3) arr.push(a);
    map.set(a.topic, arr);
  }
  return [...map.entries()].map(([topic, items]) => ({
    topic,
    priority: items.some((i) => i.priority),
    items,
  }));
}

/** "sábado 19 de julio de 2026" (se muestra en mayúsculas por CSS). */
function dateline(date: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function EditionView({
  edition,
  isToday = false,
}: {
  edition: SerializedEdition;
  isToday?: boolean;
}) {
  const groups = groupByTopic(edition.articles);

  return (
    <article className="space-y-9">
      {/* Cabecera editorial: dateline + lede */}
      <header className="animate-news-in">
        <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            {dateline(edition.date)}
          </p>
          {isToday && (
            <span className="text-[11px] uppercase tracking-[0.18em] text-primary shrink-0">
              edición del día
            </span>
          )}
        </div>

        {edition.summary && (
          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted mb-2.5">
              El resumen del día
            </p>
            <p className="font-news text-[20px] md:text-[23px] leading-[1.55] text-foreground">
              {edition.summary}
            </p>
          </div>
        )}
      </header>

      {groups.length === 0 && (
        <p className="text-sm text-muted">
          No se encontraron noticias para esta edición.
        </p>
      )}

      {/* Una sección editorial por tema */}
      {groups.map((g, i) => (
        <TopicSection key={g.topic} group={g} index={i} />
      ))}

      {groups.length > 0 && (
        <p className="flex items-start gap-1.5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted">
          <ShieldCheck size={13} className="mt-px shrink-0 text-success/70" />
          <span>
            Priorizamos <span className="text-foreground/70">fuentes reconocidas</span>{" "}
            (<BadgeCheck size={11} className="inline -mt-0.5 text-success/80" />) y
            filtramos clickbait y noticias sin confirmar. Aun así, verificá siempre
            antes de compartir.
          </span>
        </p>
      )}
    </article>
  );
}

function TopicSection({ group, index }: { group: TopicGroup; index: number }) {
  const { topic, priority, items } = group;
  const [lead, ...rest] = items;

  return (
    <section
      className="animate-news-in"
      style={{ "--news-delay": `${0.06 * (index + 1)}s` } as CSSProperties}
    >
      {/* Encabezado de sección: tema · regla · prioridad · conteo */}
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-foreground shrink-0">
          {topic}
        </h3>
        {priority && (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-warning shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            prioritario
          </span>
        )}
        <span className="flex-1 h-px bg-border" />
        <span className="font-mono text-[11px] text-muted shrink-0">
          {items.length} {items.length === 1 ? "nota" : "notas"}
        </span>
      </div>

      {lead && <Story article={lead} lead />}

      {rest.length > 0 && (
        <div className="mt-1 border-t border-border divide-y divide-border">
          {rest.map((a, i) => (
            <Story key={i} article={a} />
          ))}
        </div>
      )}
    </section>
  );
}

function Story({
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
      className={`group block ${lead ? "pb-5" : "py-4"}`}
    >
      <h4
        className={`font-news font-medium text-foreground transition-colors group-hover:text-primary ${
          lead
            ? "text-[24px] md:text-[28px] leading-[1.18]"
            : "text-[18px] md:text-[19px] leading-[1.28]"
        }`}
      >
        {article.title}
      </h4>

      {article.summary && (
        <p
          className={`mt-2 text-muted leading-relaxed ${
            lead ? "text-[15px]" : "text-sm line-clamp-2"
          }`}
        >
          {article.summary}
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted">
        <span className="font-medium text-foreground/70">{article.source}</span>
        {article.reputable && (
          <BadgeCheck
            size={13}
            className="text-success/80 shrink-0"
            aria-label="Fuente reconocida"
          />
        )}
        {ago && (
          <>
            <span className="text-border">·</span>
            <span>{ago}</span>
          </>
        )}
        <ExternalLink
          size={13}
          className="ml-0.5 text-primary opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0"
        />
      </div>
    </a>
  );
}
