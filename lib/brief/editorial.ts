import {
  BRIEF_LENGTH_LIMITS,
  type BriefLength,
  type SerializedBriefItem,
} from "@/lib/brief/types";

export type BriefEditorialSelection = {
  keys: SerializedBriefItem[];
  social: SerializedBriefItem[];
  topics: Array<{ topic: string; items: SerializedBriefItem[] }>;
};

/**
 * Aplica los límites finitos de lectura en un solo lugar. No agrega contenido,
 * no pagina y evita repetir en temas lo que ya aparece como clave.
 */
export function selectBriefSections(
  items: SerializedBriefItem[],
  length: BriefLength
): BriefEditorialSelection {
  const limits = BRIEF_LENGTH_LIMITS[length];
  const explicitKeys = items
    .filter((item) => item.section === "KEYS")
    .slice(0, 3);
  const keys =
    explicitKeys.length > 0
      ? explicitKeys
      : items.filter((item) => item.kind === "NEWS").slice(0, 3);
  const keyUrls = new Set(keys.map((item) => item.url));

  const social = items
    .filter((item) => item.kind === "SOCIAL" && !keyUrls.has(item.url))
    .slice(0, limits.social);

  const groups = new Map<string, SerializedBriefItem[]>();
  for (const item of items) {
    if (item.kind !== "NEWS" || keyUrls.has(item.url)) continue;
    const topic = item.topic || "Otros temas";
    const current = groups.get(topic) ?? [];
    if (current.length < limits.perTopic) current.push(item);
    groups.set(topic, current);
  }

  let remaining = limits.total;
  const topics: Array<{ topic: string; items: SerializedBriefItem[] }> = [];
  for (const [topic, topicItems] of groups) {
    if (remaining <= 0) break;
    const selected = topicItems.slice(0, remaining);
    if (selected.length) topics.push({ topic, items: selected });
    remaining -= selected.length;
  }

  return { keys, social, topics };
}
