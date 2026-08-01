import { describe, expect, it } from "vitest";
import {
  deriveTopics,
  frontForTopic,
  inclusionReasonForFront,
  northNeedsReview,
  suggestTopics,
  type NorthFront,
} from "@/lib/circle-north";

function front(over: Partial<NorthFront> = {}): NorthFront {
  return {
    id: "f1",
    label: "Tener obra propia",
    detail: null,
    topics: ["arquitectura", "construccion"],
    position: 0,
    ...over,
  };
}

describe("suggestTopics", () => {
  it("conserva la intencion completa de la persona", () => {
    expect(suggestTopics("Quiero tener mi propia obra de arquitectura")).toEqual([
      "Quiero tener mi propia obra de arquitectura",
    ]);
  });

  it("combina el frente y su explicacion", () => {
    expect(suggestTopics("Aplicar IA en arquitectura", "Quiero mejorar la gestión de obra")).toEqual([
      "Aplicar IA en arquitectura. Quiero mejorar la gestión de obra",
    ]);
  });

  it("normaliza espacios sin romper la frase", () => {
    expect(suggestTopics("  IA   para arquitectos  ", "  aplicada a presupuestos ")).toEqual([
      "IA para arquitectos. aplicada a presupuestos",
    ]);
  });

  it("una etiqueta vacia no inventa nada", () => {
    expect(suggestTopics("")).toEqual([]);
  });
});

describe("deriveTopics", () => {
  it("deriva una intencion completa por frente", () => {
    const topics = deriveTopics([
      front({ id: "a", label: "Mejorar mi salud", detail: "Volver a correr", position: 0 }),
      front({ id: "b", label: "Comer mejor", detail: null, position: 1 }),
    ]);
    expect(topics.topics).toEqual(["Mejorar mi salud. Volver a correr", "Comer mejor"]);
  });

  it("los temas del frente principal son los prioritarios", () => {
    const topics = deriveTopics([
      front({ id: "b", label: "Ordenar mis finanzas", position: 1 }),
      front({ id: "a", label: "Mejorar mi salud", position: 0 }),
    ]);
    expect(topics.priorityTopics).toEqual(["Mejorar mi salud"]);
  });

  it("sin frentes no inventa temas", () => {
    expect(deriveTopics([])).toEqual({ topics: [], priorityTopics: [] });
  });
});

describe("frontForTopic", () => {
  const fronts = [front({ id: "obra", label: "Tener obra propia", topics: ["arquitectura"] })];

  it("relaciona una pieza con el frente al que sirve", () => {
    expect(frontForTopic("Arquitectura", fronts)?.id).toBe("obra");
  });

  it("acepta coincidencia parcial", () => {
    expect(frontForTopic("arquitectura sustentable", fronts)?.id).toBe("obra");
  });

  it("sin relacion devuelve null en vez de forzar una razon", () => {
    expect(frontForTopic("futbol", fronts)).toBeNull();
    expect(frontForTopic(null, fronts)).toBeNull();
  });
});

describe("inclusionReasonForFront", () => {
  it("explica por que la pieza esta en la edicion", () => {
    expect(inclusionReasonForFront(front())).toBe(
      "Está acá por tu frente: Tener obra propia.",
    );
  });

  it("sin frente no escribe una razon vacia", () => {
    expect(inclusionReasonForFront(null)).toBeNull();
  });
});

describe("northNeedsReview", () => {
  const hoy = new Date("2026-08-01T12:00:00Z");

  it("pide revision a los tres meses", () => {
    expect(northNeedsReview(new Date("2026-04-01T12:00:00Z"), hoy, hoy)).toBe(true);
  });

  it("no molesta antes de tiempo", () => {
    expect(northNeedsReview(new Date("2026-07-01T12:00:00Z"), hoy, hoy)).toBe(false);
  });

  it("sin revision previa cuenta desde que se creo", () => {
    expect(northNeedsReview(null, new Date("2026-01-01T12:00:00Z"), hoy)).toBe(true);
    expect(northNeedsReview(null, new Date("2026-07-20T12:00:00Z"), hoy)).toBe(false);
  });
});
