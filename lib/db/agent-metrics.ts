import "server-only";
import { prisma } from "@/lib/prisma";
import { getAiProviderStatus, type ProviderStatus } from "@/lib/ai/provider-usage";

export type AgentMetrics = {
  messages24h: number;
  messages7d: number;
  avgLatencyMs: number;
  failures7d: number;
  confirmations7d: number;
  cancellations7d: number;
  marketQueries7d: number;
  activeRules: number;
  pendingActions: number;
  intents: { intent: string; count: number }[];
  actions: { action: string; count: number }[];
  providers: ProviderStatus;
};

export async function getAgentMetrics(): Promise<AgentMetrics> {
  const [summary, intents, actionRows, activeRules, pendingActions, providers] = await Promise.all([
    prisma.$queryRaw<{
      messages24h: number; messages7d: number; avg_latency: number;
      failures: number; confirmations: number; cancellations: number; market_queries: number;
    }[]>`
      SELECT
        count(*) FILTER (WHERE event IN ('message_processed','market_query') AND created_at >= NOW() - INTERVAL '24 hours')::int AS "messages24h",
        count(*) FILTER (WHERE event IN ('message_processed','market_query') AND created_at >= NOW() - INTERVAL '7 days')::int AS "messages7d",
        coalesce(round(avg(latency_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')), 0)::int AS avg_latency,
        count(*) FILTER (WHERE success = FALSE AND created_at >= NOW() - INTERVAL '7 days')::int AS failures,
        count(*) FILTER (WHERE event = 'pending_confirmed' AND created_at >= NOW() - INTERVAL '7 days')::int AS confirmations,
        count(*) FILTER (WHERE event = 'pending_cancelled' AND created_at >= NOW() - INTERVAL '7 days')::int AS cancellations,
        count(*) FILTER (WHERE event = 'market_query' AND created_at >= NOW() - INTERVAL '7 days')::int AS market_queries
      FROM whatsapp_agent_events`,
    prisma.$queryRaw<{ intent: string; count: number }[]>`
      SELECT coalesce(intent, 'unknown') intent, count(*)::int count
      FROM whatsapp_agent_events
      WHERE created_at >= NOW() - INTERVAL '7 days' AND event = 'message_processed'
      GROUP BY 1 ORDER BY 2 DESC`,
    prisma.$queryRaw<{ action_types: string }[]>`
      SELECT action_types FROM whatsapp_agent_events
      WHERE created_at >= NOW() - INTERVAL '7 days' AND action_types IS NOT NULL`,
    prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int count FROM whatsapp_agent_rules WHERE enabled = TRUE`,
    prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int count FROM whatsapp_pending_actions WHERE expires_at > NOW()`,
    getAiProviderStatus(),
  ]);
  const actionCounts = new Map<string, number>();
  for (const row of actionRows) {
    for (const action of row.action_types.split(",").filter(Boolean)) {
      actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
    }
  }
  const s = summary[0];
  return {
    messages24h: s?.messages24h ?? 0,
    messages7d: s?.messages7d ?? 0,
    avgLatencyMs: s?.avg_latency ?? 0,
    failures7d: s?.failures ?? 0,
    confirmations7d: s?.confirmations ?? 0,
    cancellations7d: s?.cancellations ?? 0,
    marketQueries7d: s?.market_queries ?? 0,
    activeRules: activeRules[0]?.count ?? 0,
    pendingActions: pendingActions[0]?.count ?? 0,
    intents,
    actions: [...actionCounts.entries()]
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    providers,
  };
}
