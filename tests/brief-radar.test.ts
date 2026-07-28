import { afterEach, describe, expect, it, vi } from "vitest";
import type { RawArticle } from "@/lib/services/news";
import { fetchNewsForTopic } from "@/lib/services/news";
import {
  buildRadarCandidates,
  normalizeRadarProfileUrl,
} from "@/lib/services/brief/radar-ranking";

let articleSequence = 0;

function article(
  source: string,
  sourceUrl: string | null,
  topic: string,
  overrides: Partial<RawArticle> = {}
): RawArticle {
  articleSequence += 1;
  return {
    title: `Novedad sobre ${topic}`,
    url: `https://news.google.com/article-${articleSequence}`,
    source,
    sourceUrl,
    topic,
    publishedAt: new Date().toISOString(),
    snippet: "Información verificada.",
    priority: false,
    reputable: true,
    ...overrides,
  };
}

describe("buildRadarCandidates", () => {
  it("genera sugerencias reales con explicación y señales verificables", () => {
    const candidates = buildRadarCandidates({
      articles: [
        article("Medio Uno", "https://www.mediouno.com/", "Arquitectura", {
          priority: true,
        }),
        article("Medio Uno", "http://mediouno.com", "Inteligencia artificial"),
        article("Medio Dos", "https://mediodos.com", "Economía"),
      ],
      priorityTopics: ["Arquitectura"],
      level: "BALANCED",
      limit: 2,
    });

    expect(candidates[0]).toMatchObject({
      sourceName: "Medio Uno",
      profileUrl: "https://mediouno.com",
      platform: "WEB",
      topic: "Arquitectura",
    });
    expect(candidates[0].explanation).toContain("2 noticias relevantes");
    expect(candidates[0].explanation).toContain("tema prioritario Arquitectura");
    expect(candidates[0].signals).toMatchObject({
      articleCount: 2,
      reputable: true,
      priorityTopics: ["Arquitectura"],
    });
  });

  it("excluye fuentes que el usuario ya sigue o descartó", () => {
    const candidates = buildRadarCandidates({
      articles: [
        article("Ya seguida", "https://seguida.com", "IA"),
        article("Descartada", "https://descartada.com", "IA"),
        article("Nueva", "https://nueva.com", "IA"),
      ],
      priorityTopics: [],
      level: "EXPLORER",
      limit: 3,
      excludedProfileUrls: ["https://descartada.com/"],
      excludedSourceNames: ["Ya seguida"],
    });

    expect(candidates.map((candidate) => candidate.sourceName)).toEqual(["Nueva"]);
  });

  it("penaliza clickbait y promociones débiles", () => {
    const candidates = buildRadarCandidates({
      articles: [
        article("Casino", "https://casino.com", "Negocios", {
          title: "Impactante oferta: comprá el curso que se volvió viral",
          reputable: false,
        }),
      ],
      priorityTopics: [],
      level: "EXPLORER",
      limit: 3,
    });

    expect(candidates).toEqual([]);
  });

  it("mantiene diversidad temática antes de completar el límite", () => {
    const candidates = buildRadarCandidates({
      articles: [
        article("IA Uno", "https://iauno.com", "IA"),
        article("IA Dos", "https://iados.com", "IA"),
        article("Arquitectura Hoy", "https://arquitecturahoy.com", "Arquitectura"),
      ],
      priorityTopics: [],
      level: "EXPLORER",
      limit: 2,
    });

    expect(new Set(candidates.map((candidate) => candidate.topic)).size).toBe(2);
  });

  it("en modo conservador exige una señal más fuerte y devuelve sólo una", () => {
    const candidates = buildRadarCandidates({
      articles: [
        article("Fuerte", "https://fuerte.com", "IA", { priority: true }),
        article("Fuerte", "https://fuerte.com", "IA", { priority: true }),
        article("Fuerte", "https://fuerte.com", "Negocios"),
        article("Débil", "https://debil.com", "Viajes", { reputable: false }),
      ],
      priorityTopics: ["IA"],
      level: "CONSERVATIVE",
      limit: 1,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].sourceName).toBe("Fuerte");
  });
});

describe("normalizeRadarProfileUrl", () => {
  it("normaliza la homepage y rechaza redirecciones de Google News", () => {
    expect(normalizeRadarProfileUrl("http://www.ejemplo.com/?utm_source=x")).toBe(
      "https://ejemplo.com"
    );
    expect(
      normalizeRadarProfileUrl("https://news.google.com/rss/articles/abc")
    ).toBeNull();
  });
});

describe("fetchNewsForTopic", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("conserva la URL real declarada por el medio en Google News", async () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel><item>
        <title>Nueva herramienta para estudios - Arquitectura Hoy</title>
        <link>https://news.google.com/rss/articles/abc</link>
        <source url="https://www.arquitecturahoy.com/">Arquitectura Hoy</source>
        <pubDate>Tue, 28 Jul 2026 12:00:00 GMT</pubDate>
        <description>Una noticia relevante.</description>
      </item></channel></rss>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(xml, {
          status: 200,
          headers: { "Content-Type": "application/rss+xml" },
        })
      )
    );

    const articles = await fetchNewsForTopic("Arquitectura");

    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      source: "Arquitectura Hoy",
      sourceUrl: "https://www.arquitecturahoy.com/",
      topic: "Arquitectura",
    });
  });
});
