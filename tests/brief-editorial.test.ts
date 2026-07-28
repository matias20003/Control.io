import { describe, expect, it } from "vitest";
import { selectBriefSections } from "@/lib/brief/editorial";
import type { SerializedBriefItem } from "@/lib/brief/types";

function news(
  id: string,
  topic: string,
  section: "KEYS" | "TOPICS" = "TOPICS"
): SerializedBriefItem {
  return {
    id,
    contentKey: id,
    kind: "NEWS",
    sourceType: "NEWS",
    sourceId: null,
    title: id,
    summary: id,
    url: `https://example.com/${id}`,
    topic,
    publishedAt: null,
    rank: 1,
    section,
    inclusionReason: null,
    metadata: null,
  };
}

describe("selectBriefSections", () => {
  it("no repite claves dentro de temas y limita cada grupo", () => {
    const items = [
      news("key", "IA", "KEYS"),
      news("ia-1", "IA"),
      news("ia-2", "IA"),
      news("ia-3", "IA"),
      news("ia-4", "IA"),
    ];
    const selection = selectBriefSections(items, "SHORT");
    expect(selection.keys.map((item) => item.id)).toEqual(["key"]);
    expect(selection.topics[0].items.map((item) => item.id)).toEqual([
      "ia-1",
      "ia-2",
    ]);
  });

  it("mantiene un máximo finito incluso en modo amplio", () => {
    const items = Array.from({ length: 30 }, (_, index) =>
      news(`item-${index}`, `Tema ${index % 6}`)
    );
    const selection = selectBriefSections(items, "WIDE");
    const totalTopics = selection.topics.reduce(
      (total, group) => total + group.items.length,
      0
    );
    expect(totalTopics).toBeLessThanOrEqual(15);
    expect(selection.topics.every((group) => group.items.length <= 3)).toBe(true);
  });
});
