"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Link2,
  Loader2,
  MonitorPlay,
  Radio,
  Rss,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  closeBridgeVisitAction,
  deleteChannelAction,
  openBridgeVisitAction,
  resolveChannelAction,
} from "@/app/actions/circle-system";
import type { SerializedChannel } from "@/lib/db/channels";
import type { SerializedBriefSource } from "@/lib/brief/types";
import { SectionHeading, QuietEmpty } from "./CircleUI";

export type OrphanSource = {
  id: string;
  name: string;
  platform: string | null;
  handle: string | null;
  profileUrl: string | null;
};

const KIND_ICONS: Record<string, typeof Rss> = {
  YOUTUBE: MonitorPlay,
  PODCAST: Radio,
  RSS: Rss,
  NEWSLETTER: Rss,
  WEB: Link2,
};

const KIND_LABELS: Record<string, string> = {
  YOUTUBE: "YouTube",
  PODCAST: "Podcast",
  RSS: "Blog",
  NEWSLETTER: "Newsletter",
  WEB: "Web",
};

export function ReferentesView({
  sources,
  channels,
  orphans,
  onChannelsChange,
}: {
  sources: SerializedBriefSource[];
  channels: Record<string, SerializedChannel[]>;
  orphans: OrphanSource[];
  onChannelsChange: (next: Record<string, SerializedChannel[]>) => void;
}) {
  const referentes = sources.filter((source) => source.category !== "CLOSE");
  const conCanal = referentes.filter((source) => (channels[source.id] ?? []).length > 0);
  const percent =
    referentes.length === 0
      ? 0
      : Math.round((conCanal.length / referentes.length) * 100);

  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="La obra, no el perfil"
        title="Referentes"
        description="De un referente no importa la persona: importa lo que produce. Y eso casi nunca vive en Instagram — vive en su blog, su canal o su newsletter. Acá se trae eso adentro."
      />

      {referentes.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-surface/60 px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              {conCanal.length} de {referentes.length} referentes ya viven en
              Control.io
            </p>
            <p className="text-xs text-muted">{percent}%</p>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Cobertura de referentes con canal propio"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          {orphans.length > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {orphans.length}{" "}
              {orphans.length === 1
                ? "referente te obliga"
                : "referentes te obligan"}{" "}
              a entrar a una plataforma cerrada. Ese número tiene que bajar.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {referentes.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            channels={channels[source.id] ?? []}
            onChannelsChange={(next) =>
              onChannelsChange({ ...channels, [source.id]: next })
            }
          />
        ))}
        {referentes.length === 0 && (
          <div className="rounded-xl border border-border bg-surface/45">
            <QuietEmpty text="Todavía no hay referentes. Cuando agregues uno, acá le buscamos su canal propio." />
          </div>
        )}
      </div>
    </section>
  );
}

function SourceCard({
  source,
  channels,
  onChannelsChange,
}: {
  source: SerializedBriefSource;
  channels: SerializedChannel[];
  onChannelsChange: (next: SerializedChannel[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [isResolving, startResolving] = useTransition();
  const [orphanReason, setOrphanReason] = useState<string | null>(null);
  const esHuerfano = channels.length === 0;

  const add = () => {
    const clean = url.trim();
    if (!clean) return;
    setOrphanReason(null);
    startResolving(async () => {
      const result = await resolveChannelAction(source.id, clean);
      if (result.error || !result.channel) {
        if (result.orphan) {
          setOrphanReason(result.error ?? "Ahí no hay un canal abierto.");
        } else {
          toast.error(result.error ?? "No pudimos revisar esa dirección.");
        }
        return;
      }
      onChannelsChange([...channels, result.channel]);
      setUrl("");
      toast.success(`Listo: ahora seguís a ${source.name} por su canal.`);
    });
  };

  const remove = (channel: SerializedChannel) => {
    startResolving(async () => {
      const result = await deleteChannelAction(channel.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onChannelsChange(channels.filter((item) => item.id !== channel.id));
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/45">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {source.name}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {esHuerfano
              ? "Sin canal propio todavía"
              : `${channels.length} ${channels.length === 1 ? "canal" : "canales"}`}
          </p>
        </div>
        {esHuerfano ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-dim px-2.5 py-1 text-xs font-semibold text-warning">
            <AlertTriangle size={13} />
            Huérfano
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-dim px-2.5 py-1 text-xs font-semibold text-success">
            <Check size={13} />
            En Control.io
          </span>
        )}
      </div>

      {channels.map((channel) => {
        const Icon = KIND_ICONS[channel.kind] ?? Rss;
        return (
          <div
            key={channel.id}
            className="flex min-h-16 items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">
                {channel.title || KIND_LABELS[channel.kind] || channel.kind}
              </p>
              <p className="truncate text-xs text-muted">{channel.feedUrl}</p>
              {channel.status === "ERROR" && channel.lastError && (
                <p className="mt-0.5 text-xs text-danger">{channel.lastError}</p>
              )}
              {channel.status === "EMPTY" && (
                <p className="mt-0.5 text-xs text-muted">
                  El canal existe pero no publicó nada todavía.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(channel)}
              aria-label={`Sacar el canal ${channel.feedUrl}`}
              className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-danger-dim hover:text-danger"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}

      <div className="px-4 py-4">
        <label
          htmlFor={`canal-${source.id}`}
          className="text-xs font-medium text-muted"
        >
          ¿Dónde publica lo que te sirve?
        </label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Input
            id={`canal-${source.id}`}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder="su blog, su canal de YouTube, su newsletter…"
            className="min-w-[220px] flex-1"
          />
          <Button onClick={add} disabled={isResolving || !url.trim()}>
            {isResolving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Link2 size={16} />
            )}
            Buscar canal
          </Button>
        </div>

        {orphanReason && (
          <BridgeOffer
            sourceId={source.id}
            name={source.name}
            reason={orphanReason}
            handle={source.account?.handle ?? null}
            profileUrl={source.account?.profileUrl ?? null}
          />
        )}
      </div>
    </div>
  );
}

/**
 * El puente. Aparece sólo cuando el referente no tiene canal propio, y siempre
 * pidiendo una intención antes: sin escribir a qué vas, no hay puente.
 */
function BridgeOffer({
  sourceId,
  name,
  reason,
  handle,
  profileUrl,
}: {
  sourceId: string;
  name: string;
  reason: string;
  handle: string | null;
  profileUrl: string | null;
}) {
  const [intention, setIntention] = useState("");
  const [visitId, setVisitId] = useState<string | null>(null);
  const [finding, setFinding] = useState("");
  const [isPending, startPending] = useTransition();

  const abrir = () => {
    const clean = intention.trim();
    if (clean.length < 3) {
      toast.error("Escribí a qué vas. Sin eso, esto es scroll.");
      return;
    }
    startPending(async () => {
      const result = await openBridgeVisitAction({
        sourceId,
        handle: handle ?? name,
        intention: clean,
      });
      if (result.error || !result.visit) {
        toast.error(result.error ?? "No pudimos abrir el puente.");
        return;
      }
      setVisitId(result.visit.id);
      const destino =
        profileUrl ?? `https://www.instagram.com/${(handle ?? name).replace(/^@/, "")}/`;
      window.open(destino, "_blank", "noopener,noreferrer");
    });
  };

  const cerrar = () => {
    if (!visitId) return;
    startPending(async () => {
      const result = await closeBridgeVisitAction(visitId, finding.trim() || null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setVisitId(null);
      setFinding("");
      setIntention("");
      toast.success("Anotado.");
    });
  };

  return (
    <div className="mt-3 rounded-lg border border-warning/30 bg-warning-dim px-4 py-3">
      <p className="text-xs leading-relaxed text-warning">{reason}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Podés entrar igual, pero con un marco. No podemos encerrar a esa
        plataforma desde acá — lo único que podemos hacer es que la visita tenga
        un motivo escrito y un final.
      </p>

      {visitId === null ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={intention}
            onChange={(event) => setIntention(event.target.value)}
            placeholder="¿A qué vas?"
            className="min-w-[200px] flex-1"
          />
          <Button variant="secondary" onClick={abrir} disabled={isPending}>
            <ExternalLink size={15} />
            Abrir con intención
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs font-medium text-foreground">
            Volviste. ¿Qué encontraste?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              value={finding}
              onChange={(event) => setFinding(event.target.value)}
              placeholder="Puede quedar vacío: no siempre hay algo."
              className="min-w-[200px] flex-1"
            />
            <Button variant="secondary" onClick={cerrar} disabled={isPending}>
              {isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
