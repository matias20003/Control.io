"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Loader2, Mail, AlertCircle, ExternalLink, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type Email = {
  uid: number;
  messageId: string;
  from: string;
  fromAddress: string;
  subject: string;
  date: string;
  seen: boolean;
  category: string;
  priority: "alta" | "media" | "baja";
  reason: string;
};

const PRIO_ORDER = { alta: 0, media: 1, baja: 2 } as const;
const PRIO = {
  alta: { dot: "bg-danger", text: "text-danger", label: "Alta", chip: "bg-danger/10 text-danger" },
  media: { dot: "bg-warning", text: "text-warning", label: "Media", chip: "bg-warning/10 text-warning" },
  baja: { dot: "bg-muted", text: "text-muted", label: "Baja", chip: "bg-surface-2 text-muted" },
} as const;

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "hace min";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d` : new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

const gmailLink = (m: Email) =>
  m.messageId
    ? `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(m.messageId)}`
    : "https://mail.google.com/mail/u/0/#inbox";

export function CorreosClient() {
  const [emails, setEmails] = useState<Email[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"todos" | "alta" | "media" | "baja">("todos");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/correos", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al leer la bandeja");
      setEmails(data.emails ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const list = (emails ?? [])
    .slice()
    .sort((a, b) =>
      PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority] ||
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  const shown = filter === "todos" ? list : list.filter((e) => e.priority === filter);

  const total = emails?.length ?? 0;
  const unread = emails?.filter((e) => !e.seen).length ?? 0;
  const highPrio = emails?.filter((e) => e.priority === "alta").length ?? 0;

  return (
    <div className="space-y-4 mt-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Bandeja unificada</h1>
          <p className="text-xs text-muted">Últimos correos, clasificados por IA por prioridad.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/50 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Actualizar
        </button>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Correos" value={total} icon={Mail} accent="text-foreground" />
        <Tile label="No leídos" value={unread} icon={Circle} accent="text-primary" />
        <Tile label="Alta prioridad" value={highPrio} icon={AlertCircle} accent="text-danger" />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-1.5">
        {(["todos", "alta", "media", "baja"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize",
              filter === f ? "bg-primary text-white" : "bg-surface-2 text-muted hover:text-foreground"
            )}
          >
            {f === "todos" ? "Todos" : PRIO[f].label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{error}</div>
      ) : loading && !emails ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <Loader2 size={22} className="animate-spin mr-2" /> Leyendo y clasificando tu bandeja...
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border">
          {shown.length === 0 ? (
            <p className="text-sm text-muted text-center py-10">Sin correos en este filtro.</p>
          ) : (
            shown.map((m) => {
              const p = PRIO[m.priority];
              return (
                <a
                  key={m.uid}
                  href={gmailLink(m)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40"
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", m.seen ? "bg-transparent border border-border" : p.dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn("truncate text-sm", m.seen ? "font-medium text-foreground" : "font-bold text-foreground")}>
                        {m.from}
                      </p>
                      <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", p.chip)}>{m.category}</span>
                    </div>
                    <p className={cn("truncate text-sm", m.seen ? "text-muted" : "text-foreground")}>{m.subject}</p>
                    {m.reason && <p className="truncate text-[11px] text-muted mt-0.5">{m.reason}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-muted">{relTime(m.date)}</span>
                    <ExternalLink size={13} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ElementType; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-muted">
        <Icon size={13} />
        <p className="text-[10px] font-semibold uppercase tracking-widest">{label}</p>
      </div>
      <p className={cn("mt-1 text-2xl font-black tabular-nums", accent)}>{value}</p>
    </div>
  );
}
