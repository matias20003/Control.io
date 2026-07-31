import "server-only";
import { prisma } from "@/lib/prisma";

export type AiProvider = "gemini" | "openrouter";

export async function recordAiProviderUsage(input: {
  provider: AiProvider;
  model: string;
  success: boolean;
  statusCode?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number | null;
}) {
  await prisma.$executeRaw`
    INSERT INTO ai_provider_usage
      (provider, model, success, status_code, prompt_tokens, completion_tokens, total_tokens, cost_usd)
    VALUES (
      ${input.provider}, ${input.model}, ${input.success}, ${input.statusCode ?? null},
      ${input.promptTokens ?? 0}, ${input.completionTokens ?? 0}, ${input.totalTokens ?? 0},
      ${input.costUsd ?? null}
    )`;
}

export type ProviderStatus = {
  activeProvider: AiProvider;
  gemini: {
    configured: boolean;
    model: string;
    status: "available" | "quota_exceeded" | "error" | "not_configured" | "unknown";
    requests24h: number;
    tokens24h: number;
    tokens7d: number;
    quotaErrors24h: number;
    lastUsedAt: string | null;
  };
  openrouter: {
    configured: boolean;
    model: string;
    status: "available" | "insufficient_credits" | "error" | "not_configured" | "unknown";
    requests24h: number;
    tokens24h: number;
    tokens7d: number;
    cost7d: number;
    usage: number | null;
    limit: number | null;
    remaining: number | null;
    isFreeTier: boolean | null;
    lastUsedAt: string | null;
    liveError: string | null;
  };
};

type UsageRow = {
  provider: AiProvider;
  requests24h: number;
  tokens24h: number;
  tokens7d: number;
  cost7d: number;
  quota_errors: number;
  last_used_at: Date | null;
  last_success_at: Date | null;
  last_status: number | null;
};

async function getOpenRouterLive() {
  const key = process.env.OPENAI_API_KEY;
  const base = (process.env.OPENAI_BASE_URL ?? "").toLowerCase();
  if (!key || !base.includes("openrouter")) return null;
  const res = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${key}` },
    next: { revalidate: 60 },
  });
  const json = await res.json().catch(() => ({})) as {
    data?: { usage?: number; limit?: number | null; limit_remaining?: number | null; is_free_tier?: boolean };
    error?: { message?: string };
  };
  if (!res.ok) return { error: json.error?.message ?? `OpenRouter ${res.status}`, status: res.status };
  return {
    usage: json.data?.usage ?? null,
    limit: json.data?.limit ?? null,
    remaining: json.data?.limit_remaining ?? null,
    isFreeTier: json.data?.is_free_tier ?? null,
  };
}

export async function getAiProviderStatus(): Promise<ProviderStatus> {
  let rows: UsageRow[] = [];
  try {
    rows = await prisma.$queryRaw<UsageRow[]>`
      SELECT provider,
        count(*) FILTER (WHERE success AND created_at >= NOW() - INTERVAL '24 hours')::int AS "requests24h",
        coalesce(sum(total_tokens) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'), 0)::int AS "tokens24h",
        coalesce(sum(total_tokens) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0)::int AS "tokens7d",
        coalesce(sum(cost_usd) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0)::float8 AS "cost7d",
        count(*) FILTER (WHERE status_code = 429 AND created_at >= NOW() - INTERVAL '24 hours')::int AS quota_errors,
        max(created_at) AS last_used_at,
        max(created_at) FILTER (WHERE success) AS last_success_at,
        (array_agg(status_code ORDER BY created_at DESC))[1] AS last_status
      FROM ai_provider_usage GROUP BY provider`;
  } catch {
    // La UI sigue funcionando durante el primer deploy antes de la migración.
  }
  const map = new Map(rows.map((row) => [row.provider, row]));
  const gemini = map.get("gemini");
  const router = map.get("openrouter");
  const latestGemini = gemini?.last_success_at?.getTime() ?? 0;
  const latestRouter = router?.last_success_at?.getTime() ?? 0;
  const activeProvider: AiProvider = latestRouter > latestGemini ? "openrouter" : "gemini";
  const live = await getOpenRouterLive().catch((error) => ({ error: error instanceof Error ? error.message : "Error", status: 0 }));
  const liveError = live && "error" in live ? live.error : null;
  const liveStatus = live && "status" in live ? live.status : null;

  return {
    activeProvider,
    gemini: {
      configured: !!process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
      status: !process.env.GEMINI_API_KEY ? "not_configured" : gemini?.last_status === 429 ? "quota_exceeded" : gemini?.last_status && gemini.last_status >= 400 ? "error" : gemini ? "available" : "unknown",
      requests24h: gemini?.requests24h ?? 0,
      tokens24h: gemini?.tokens24h ?? 0,
      tokens7d: gemini?.tokens7d ?? 0,
      quotaErrors24h: gemini?.quota_errors ?? 0,
      lastUsedAt: gemini?.last_used_at?.toISOString() ?? null,
    },
    openrouter: {
      configured: !!process.env.OPENAI_API_KEY && (process.env.OPENAI_BASE_URL ?? "").includes("openrouter"),
      model: process.env.CHAT_MODEL ?? "gpt-4o-mini",
      status: !process.env.OPENAI_API_KEY ? "not_configured" : liveStatus === 402 ? "insufficient_credits" : liveError ? "error" : live ? "available" : "unknown",
      requests24h: router?.requests24h ?? 0,
      tokens24h: router?.tokens24h ?? 0,
      tokens7d: router?.tokens7d ?? 0,
      cost7d: router?.cost7d ?? 0,
      usage: live && !("error" in live) ? live.usage : null,
      limit: live && !("error" in live) ? live.limit : null,
      remaining: live && !("error" in live) ? live.remaining : null,
      isFreeTier: live && !("error" in live) ? live.isFreeTier : null,
      lastUsedAt: router?.last_used_at?.toISOString() ?? null,
      liveError: liveError ?? null,
    },
  };
}
