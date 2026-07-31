import { Activity, Cpu, ExternalLink, Gauge, Sparkles } from "lucide-react";
import type { AgentMetrics } from "@/lib/db/agent-metrics";

const number = new Intl.NumberFormat("es-AR");
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const when = (value: string | null) => value
  ? new Date(value).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })
  : "Sin uso registrado";

const statusText = {
  available: "Disponible",
  quota_exceeded: "Cuota agotada",
  insufficient_credits: "Sin crédito",
  error: "Con error",
  not_configured: "No configurado",
  unknown: "Sin datos",
};

export function AgentMetricsPanel({ metrics }: { metrics: AgentMetrics }) {
  const cards = [
    ["Mensajes 24 h", metrics.messages24h],
    ["Mensajes 7 días", metrics.messages7d],
    ["Latencia media", `${metrics.avgLatencyMs} ms`],
    ["Fallos 7 días", metrics.failures7d],
    ["Cotizaciones", metrics.marketQueries7d],
    ["Confirmadas", metrics.confirmations7d],
    ["Canceladas", metrics.cancellations7d],
    ["Reglas activas", metrics.activeRules],
    ["Pendientes", metrics.pendingActions],
  ];
  const { providers } = metrics;
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Activity size={19} /></span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Proveedor usado actualmente</p>
            <p className="mt-0.5 text-lg font-bold capitalize text-foreground">{providers.activeProvider}</p>
          </div>
          <span className="ml-auto rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">En ejecución</span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Gemini es el proveedor principal. OpenRouter entra automáticamente como respaldo cuando Gemini falla o alcanza su cuota.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ProviderCard
          name="Gemini"
          active={providers.activeProvider === "gemini"}
          icon={<Sparkles size={18} />}
          model={providers.gemini.model}
          status={providers.gemini.status}
          lastUsed={providers.gemini.lastUsedAt}
          rows={[
            ["Solicitudes 24 h", number.format(providers.gemini.requests24h)],
            ["Tokens 24 h", number.format(providers.gemini.tokens24h)],
            ["Tokens 7 días", number.format(providers.gemini.tokens7d)],
            ["Errores de cuota 24 h", number.format(providers.gemini.quotaErrors24h)],
          ]}
          footer={
            <a href="https://ai.dev/usage?tab=rate-limit" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Ver cuota exacta en Google AI Studio <ExternalLink size={11} />
            </a>
          }
          note="Google no expone el saldo o límite restante de AI Studio mediante la API key. Los tokens mostrados son el consumo medido por Control.io."
        />
        <ProviderCard
          name="OpenRouter"
          active={providers.activeProvider === "openrouter"}
          icon={<Cpu size={18} />}
          model={providers.openrouter.model}
          status={providers.openrouter.status}
          lastUsed={providers.openrouter.lastUsedAt}
          rows={[
            ["Crédito restante", providers.openrouter.remaining == null ? "No informado" : usd.format(providers.openrouter.remaining)],
            ["Uso total de la clave", providers.openrouter.usage == null ? "No informado" : usd.format(providers.openrouter.usage)],
            ["Tokens 24 h", number.format(providers.openrouter.tokens24h)],
            ["Tokens 7 días", number.format(providers.openrouter.tokens7d)],
            ["Costo medido 7 días", usd.format(providers.openrouter.cost7d)],
          ]}
          footer={<span>{providers.openrouter.isFreeTier === true ? "Clave Free Tier" : providers.openrouter.isFreeTier === false ? "Clave paga" : "Plan no informado"}</span>}
          note={providers.openrouter.liveError ? `No se pudo consultar el saldo: ${providers.openrouter.liveError}` : "Saldo consultado en vivo con la API oficial de OpenRouter y actualizado cada minuto."}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <MetricList title="Intenciones" rows={metrics.intents.map((row) => [row.intent, row.count])} />
        <MetricList title="Acciones más usadas" rows={metrics.actions.map((row) => [row.action, row.count])} />
      </div>
    </section>
  );
}

function ProviderCard(props: {
  name: string; active: boolean; icon: React.ReactNode; model: string;
  status: keyof typeof statusText; lastUsed: string | null;
  rows: [string, string][]; footer: React.ReactNode; note: string;
}) {
  const healthy = props.status === "available";
  return (
    <div className={`rounded-2xl border bg-surface p-5 ${props.active ? "border-primary/50 ring-1 ring-primary/15" : "border-border"}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-primary">{props.icon}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2"><h3 className="font-semibold text-foreground">{props.name}</h3>{props.active && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">Activo</span>}</div>
          <p className="truncate font-mono text-[11px] text-muted">{props.model}</p>
        </div>
        <span className={`ml-auto rounded-full px-2 py-1 text-[10px] font-semibold ${healthy ? "bg-success/10 text-success" : props.status === "unknown" ? "bg-surface-2 text-muted" : "bg-danger/10 text-danger"}`}>{statusText[props.status]}</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {props.rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 text-xs"><span className="text-muted">{label}</span><span className="font-mono font-semibold tabular-nums text-foreground">{value}</span></div>)}
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[11px] text-muted"><Gauge size={12} /> Último uso: {when(props.lastUsed)}</div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted">{props.note}</p>
      <div className="mt-2 text-[11px] text-muted">{props.footer}</div>
    </div>
  );
}

function MetricList({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.length ? rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span>{label.replaceAll("_", " ")}</span><span className="font-mono font-semibold">{value}</span>
          </div>
        )) : <p className="text-sm text-muted">Todavía no hay datos.</p>}
      </div>
    </div>
  );
}
