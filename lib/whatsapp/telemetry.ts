import "server-only";
import { prisma } from "@/lib/prisma";

type AgentEvent = {
  userId: string;
  event: string;
  intent?: string;
  actionTypes?: string[];
  provider?: string;
  latencyMs?: number;
  success?: boolean;
  errorCode?: string;
};

export async function recordAgentEvent(value: AgentEvent): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "whatsapp_agent_events"
      (user_id, event, intent, action_types, provider, latency_ms, success, error_code)
    VALUES (
      ${value.userId},
      ${value.event},
      ${value.intent ?? null},
      ${value.actionTypes?.join(",") ?? null},
      ${value.provider ?? null},
      ${value.latencyMs ?? null},
      ${value.success ?? true},
      ${value.errorCode ?? null}
    )`;
}
