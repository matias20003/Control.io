"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Newspaper,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
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
      sendHour !== config.sendHour,
    [topics, priority, isActive, sendHour, config]
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
      });
      if (res.error) toast.error(res.error);
      else if (res.success && res.config) {
        setConfig(res.config);
        setTopics(res.config.topics);
        setPriority(res.config.priorityTopics);
        setIsActive(res.config.isActive);
        setSendHour(res.config.sendHour);
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
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-primary/15 shrink-0">
            <Newspaper size={22} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">Newsletter</h1>
            <p className="text-xs text-muted leading-snug">
              Tu edición diaria de noticias, filtrada por tus temas.
            </p>
          </div>
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
                    <Bell size={13} className="text-primary" />
                    Generar mi edición automáticamente todos los días
                  </span>
                  <span className="text-xs text-muted">
                    Te avisamos por notificación (y WhatsApp si lo tenés vinculado)
                    cuando esté lista.
                  </span>
                </span>
              </label>

              {isActive && (
                <div className="flex items-center gap-2.5 pl-6">
                  <Clock size={14} className="text-muted shrink-0" />
                  <span className="text-sm text-foreground">A las</span>
                  <Select
                    value={String(sendHour)}
                    onChange={(e) => setSendHour(Number(e.target.value))}
                    className="h-9 w-28"
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

function EditionView({
  edition,
  isToday = false,
}: {
  edition: SerializedEdition;
  isToday?: boolean;
}) {
  const highlights = edition.articles.filter((a) => a.highlight);
  const rest = edition.articles.filter((a) => !a.highlight);
  const [lead, ...moreHighlights] = highlights;

  return (
    <div className="space-y-4">
      {isToday && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground capitalize">
            {formatDateLong(edition.date)}
          </span>
          <Badge variant="success">Hoy</Badge>
          {edition.articles.length > 0 && (
            <span className="text-xs text-muted">
              · {edition.articles.length} noticias
            </span>
          )}
        </div>
      )}

      {/* Análisis del día */}
      <Card variant="glass">
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={15} className="text-primary" />
            <span className="text-xs font-semibold text-muted uppercase tracking-wide">
              Análisis del día
            </span>
          </div>
          <p className="text-[15px] text-foreground leading-relaxed">
            {edition.summary}
          </p>
        </CardContent>
      </Card>

      {edition.articles.length === 0 && (
        <p className="text-sm text-muted px-1">
          No se encontraron noticias para esta edición.
        </p>
      )}

      {/* Lo sobresaliente */}
      {highlights.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-muted uppercase tracking-[0.08em] px-1 flex items-center gap-1.5">
            <Star size={12} className="text-warning" /> Lo sobresaliente
          </p>
          {lead && <ArticleCard article={lead} size="lead" />}
          {moreHighlights.map((a, i) => (
            <ArticleCard key={i} article={a} size="highlight" />
          ))}
        </div>
      )}

      {/* Más noticias */}
      {rest.length > 0 && (
        <div className="space-y-2">
          {highlights.length > 0 && (
            <p className="text-xs font-semibold text-muted uppercase tracking-[0.08em] px-1">
              Más noticias
            </p>
          )}
          {rest.map((a, i) => (
            <ArticleCard key={i} article={a} size="compact" />
          ))}
        </div>
      )}
    </div>
  );
}

function ArticleCard({
  article,
  size = "compact",
}: {
  article: AnalyzedArticle;
  size?: "lead" | "highlight" | "compact";
}) {
  const isLead = size === "lead";
  const isHighlight = size === "highlight" || isLead;
  const ago = timeAgo(article.publishedAt);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block rounded-xl border transition-colors hover:border-primary/40 ${
        isHighlight
          ? "border-primary/25 bg-primary/[0.04]"
          : "border-border bg-surface"
      } ${isLead ? "p-5" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {article.priority && (
            <span className="inline-flex items-center gap-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
              <Star size={10} className="fill-warning" /> Prioritario
            </span>
          )}
          <p
            className={`font-semibold text-foreground leading-snug group-hover:text-primary transition-colors ${
              isLead ? "text-lg" : "text-sm"
            }`}
          >
            {article.title}
          </p>
          {article.summary && (
            <p
              className={`text-muted mt-1 leading-relaxed ${
                isLead ? "text-sm line-clamp-3" : "text-xs line-clamp-2"
              }`}
            >
              {article.summary}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary">{article.source}</Badge>
            <span className="text-[11px] text-muted">· {article.topic}</span>
            {ago && <span className="text-[11px] text-muted">· {ago}</span>}
          </div>
        </div>
        <ExternalLink
          size={15}
          className="text-muted group-hover:text-primary shrink-0 mt-0.5 transition-colors"
        />
      </div>
    </a>
  );
}
