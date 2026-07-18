"use client";

import { useMemo, useState, useTransition } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import {
  saveNewsletterConfigAction,
  generateNewsletterNowAction,
} from "@/app/actions/newsletter";
import type { SerializedConfig, SerializedEdition } from "@/lib/db/newsletter";
import type { AnalyzedArticle } from "@/lib/services/newsletter-ai";

interface Props {
  initialConfig: SerializedConfig;
  initialEditions: SerializedEdition[];
}

export function NewsletterClient({ initialConfig, initialEditions }: Props) {
  const [config, setConfig] = useState<SerializedConfig>(initialConfig);
  const [editions, setEditions] = useState<SerializedEdition[]>(initialEditions);
  const [topics, setTopics] = useState<string[]>(initialConfig.topics);
  const [topicInput, setTopicInput] = useState("");
  const [showConfig, setShowConfig] = useState(initialConfig.topics.length === 0);
  const [isSaving, startSave] = useTransition();
  const [isGenerating, startGenerate] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);

  const today = editions[0] ?? null;
  const history = editions.slice(1);

  const dirty = useMemo(
    () => JSON.stringify(topics) !== JSON.stringify(config.topics),
    [topics, config.topics]
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

  const removeTopic = (t: string) =>
    setTopics((prev) => prev.filter((x) => x !== t));

  const saveConfig = () => {
    startSave(async () => {
      const res = await saveNewsletterConfigAction({
        topics,
        language: config.language,
        country: config.country,
        isActive: config.isActive,
      });
      if (res.error) toast.error(res.error);
      else if (res.success && res.config) {
        setConfig(res.config);
        toast.success("Temas guardados");
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
      toast.error("Guardá los temas antes de generar");
      return;
    }
    startGenerate(async () => {
      const res = await generateNewsletterNowAction();
      if (res.error) toast.error(res.error);
      else if (res.success && res.edition) {
        setEditions((prev) => {
          const rest = prev.filter((e) => e.id !== res.edition!.id);
          return [res.edition!, ...rest];
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
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/15">
            <Newspaper size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Newsletter</h1>
            <p className="text-xs text-muted">
              Tus noticias del día, filtradas por tus temas.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setShowConfig((v) => !v)}
            title="Configurar temas"
          >
            <Settings2 size={18} />
          </Button>
          <Button onClick={generateNow} disabled={isGenerating}>
            <RefreshCw
              size={16}
              className={isGenerating ? "animate-spin" : ""}
            />
            {isGenerating ? "Generando…" : "Generar ahora"}
          </Button>
        </div>
      </div>

      {/* Config de temas */}
      {showConfig && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">
                Temas que te interesan
              </p>
              <p className="text-xs text-muted mb-3">
                Ej: “inteligencia artificial”, “dólar Argentina”, “Boca Juniors”,
                “energías renovables”. Cada día armamos tu edición con lo
                sobresaliente de estos temas.
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
                  {topics.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 pl-3 pr-1.5 py-1 text-sm text-foreground"
                    >
                      {t}
                      <button
                        onClick={() => removeTopic(t)}
                        className="rounded-full p-0.5 hover:bg-surface-3 text-muted hover:text-foreground"
                        aria-label={`Quitar ${t}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={config.isActive}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, isActive: e.target.checked }))
                }
                className="h-4 w-4 accent-primary"
              />
              Generar mi edición automáticamente todos los días
            </label>

            <div className="flex justify-end">
              <Button onClick={saveConfig} disabled={isSaving}>
                {isSaving ? "Guardando…" : "Guardar temas"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edición de hoy */}
      {today ? (
        <EditionView
          edition={today}
          isToday
        />
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
              onClick={topics.length === 0 ? () => setShowConfig(true) : generateNow}
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
                <div>
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {formatDate(ed.date)}
                  </p>
                  <p className="text-xs text-muted line-clamp-1">{ed.summary}</p>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-muted transition-transform ${
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

  return (
    <div className="space-y-4">
      {isToday && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground capitalize">
            {formatDate(edition.date)}
          </span>
          <Badge variant="success">Hoy</Badge>
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
          <p className="text-sm text-foreground leading-relaxed">
            {edition.summary}
          </p>
        </CardContent>
      </Card>

      {edition.articles.length === 0 && (
        <p className="text-sm text-muted px-1">
          No se encontraron noticias para esta edición.
        </p>
      )}

      {highlights.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-[0.08em] px-1 flex items-center gap-1.5">
            <Star size={12} className="text-warning" /> Lo sobresaliente
          </p>
          {highlights.map((a, i) => (
            <ArticleCard key={i} article={a} highlight />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="space-y-2">
          {highlights.length > 0 && (
            <p className="text-xs font-semibold text-muted uppercase tracking-[0.08em] px-1">
              Más noticias
            </p>
          )}
          {rest.map((a, i) => (
            <ArticleCard key={i} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArticleCard({
  article,
  highlight = false,
}: {
  article: AnalyzedArticle;
  highlight?: boolean;
}) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-xl border p-4 transition-colors hover:border-primary/40 ${
        highlight
          ? "border-primary/25 bg-primary/[0.04]"
          : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">
            {article.title}
          </p>
          {article.summary && (
            <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">
              {article.summary}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary">{article.source}</Badge>
            <span className="text-[11px] text-muted">· {article.topic}</span>
          </div>
        </div>
        <ExternalLink size={15} className="text-muted shrink-0 mt-0.5" />
      </div>
    </a>
  );
}
