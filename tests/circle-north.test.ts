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
  it("saca terminos utiles de como lo escribio la persona", () => {
    expect(suggestTopics("Quiero tener mi propia obra de arquitectura")).toEqual([
      "obra",
      "arquitectura",
    ]);
  });

  it("descarta palabras que no distinguen nada", () => {
    expect(suggestTopics("ser mas o menos como los demas")).not.toContain("como");
  });

  it("no repite el mismo termino con distinto acento o mayuscula", () => {
    expect(suggestTopics("Nutrición nutricion NUTRICIÓN")).toEqual(["nutrición"]);
  });

  it("nunca devuelve mas de cuatro terminos", () => {
    const muchos = suggestTopics(
      "arquitectura construccion presupuesto materiales obras clientes",
    );
    expect(muchos).toHaveLength(4);
  });

  it("una etiqueta vacia no inventa nada", () => {
    expect(suggestTopics("")).toEqual([]);
  });
});

describe("deriveTopics", () => {
  it("junta los temas de todos los frentes sin repetir", () => {
    const topics = deriveTopics([
      front({ id: "a", position: 0, topics: ["salud", "correr"] }),
      front({ id: "b", position: 1, topics: ["correr", "nutricion"] }),
    ]);
    expect(topics.topics).toEqual(["salud", "correr", "nutricion"]);
  });

  it("los temas del frente principal son los prioritarios", () => {
    const topics = deriveTopics([
      front({ id: "b", position: 1, topics: ["finanzas"] }),
      front({ id: "a", position: 0, topics: ["salud"] }),
    ]);
    expect(topics.priorityTopics).toEqual(["salud"]);
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
