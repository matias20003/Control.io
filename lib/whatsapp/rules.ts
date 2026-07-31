import "server-only";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

export type AgentRuleKind = "MERCHANT_CATEGORY" | "MERCHANT_ACCOUNT" | "DEFAULT_ACCOUNT";

export type AgentRule = {
  id: bigint;
  kind: AgentRuleKind;
  match: string;
  value: string;
  enabled: boolean;
};

export async function listAgentRules(userId: string): Promise<AgentRule[]> {
  const rows = await prisma.$queryRaw<{
    id: bigint;
    kind: AgentRuleKind;
    match_value: string;
    result_value: string;
    enabled: boolean;
  }[]>`
    SELECT id, kind, match_value, result_value, enabled
    FROM "whatsapp_agent_rules"
    WHERE user_id = ${userId} AND enabled = TRUE
    ORDER BY id ASC`;
  return rows.flatMap((row) => {
    const match = decrypt(row.match_value);
    const value = decrypt(row.result_value);
    return match && value ? [{ id: row.id, kind: row.kind, match, value, enabled: row.enabled }] : [];
  });
}

export async function createAgentRule(
  userId: string,
  kind: AgentRuleKind,
  match: string,
  value: string
): Promise<void> {
  const cleanMatch = match.trim().slice(0, 160);
  const cleanValue = value.trim().slice(0, 160);
  if (!cleanMatch || !cleanValue) throw new Error("regla incompleta");
  await prisma.$executeRaw`
    INSERT INTO "whatsapp_agent_rules" (user_id, kind, match_value, result_value)
    VALUES (${userId}, ${kind}, ${encrypt(cleanMatch)}, ${encrypt(cleanValue)})`;
}

export async function deleteAgentRule(userId: string, ref: number): Promise<void> {
  const rules = await listAgentRules(userId);
  const target = rules[ref - 1];
  if (!target) throw new Error(`no existe la regla [#${ref}]`);
  await prisma.$executeRaw`
    UPDATE "whatsapp_agent_rules" SET enabled = FALSE, updated_at = NOW()
    WHERE id = ${target.id} AND user_id = ${userId}`;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function applyRulesToMovement<T extends {
  description?: string;
  category?: string | null;
  account?: string | null;
}>(action: T, rules: AgentRule[]): T {
  const description = normalize(action.description ?? "");
  const matches = (kind: AgentRuleKind) =>
    rules.find((rule) => rule.kind === kind && description.includes(normalize(rule.match)));

  if (!action.category) {
    const category = matches("MERCHANT_CATEGORY");
    if (category) action.category = category.value;
  }
  if (!action.account) {
    const account = matches("MERCHANT_ACCOUNT") ?? rules.find((rule) => rule.kind === "DEFAULT_ACCOUNT");
    if (account) action.account = account.value;
  }
  return action;
}

export function formatRulesForPrompt(rules: AgentRule[]): string {
  if (!rules.length) return "- (sin reglas personales)";
  return rules.map((rule, index) => {
    const label =
      rule.kind === "MERCHANT_CATEGORY" ? "categoría" :
      rule.kind === "MERCHANT_ACCOUNT" ? "cuenta" : "cuenta predeterminada";
    return `[#${index + 1}] ${rule.match} → ${label}: ${rule.value}`;
  }).join("\n");
}
