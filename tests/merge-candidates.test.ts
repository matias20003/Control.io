import { describe, expect, it } from "vitest";
import { fromMedia, isJunk, mergeCandidates } from "@/lib/services/brief/merge-candidates";
import type { RawArticle } from "@/lib/services/news";
import type { MediaCandidate } from "@/lib/services/media-feeds";

const TOPICS = [
  "Aquisicion de clientes para constructoras y desarrolladoras inmobiliarias",
  "Mundo de la inteligencia artificial. Vanguardia de la tecnologia",
];

const reputable = (source: string) => source === "Infobae";

const media = (title: string, summary: string | null, source = "Infobae"): MediaCandidate => ({
  title, summary, source, url: `https://x.test/${encodeURIComponent(title)}`, publishedAt: null, local: true,
});

const news = (title: string, topic = TOPICS[0]): RawArticle => ({
  title, url: `https://news.google.com/${encodeURIComponent(title)}`, source: "Google News",
  sourceUrl: null, topic, publishedAt: null, snippet: "", priority: false, reputable: false,
});

describe("isJunk", () => {
  it("descarta ofertas y bajadas de precio", () => {
    expect(isJunk("El mejor móvil compacto de Samsung cae de precio: la mejor oferta del Galaxy S26")).toBe(true);
    expect(isJunk("Chollo del día: auriculares a mitad de precio")).toBe(true);
  });

  it("descarta listicles", () => {
    expect(isJunk("Cuáles son las 5 ciudades más avanzadas tecnológicamente del mundo")).toBe(true);
    expect(isJunk("Los 7 mejores frameworks de 2026")).toBe(true);
    expect(isJunk("10 claves para entender la inteligencia artificial")).toBe(true);
  });

  it("descarta agenda, sorteos y minuto a minuto", () => {
    expect(isJunk("Participá de una charla sobre innovación e inteligencia artificial")).toBe(true);
    expect(isJunk("Horóscopo de hoy: qué dice tu signo")).toBe(true);
    expect(isJunk("Dólar hoy, minuto a minuto")).toBe(true);
  });

  it("no descarta noticias de verdad, aunque tengan numeros", () => {
    expect(isJunk("La IA resolvió problemas matemáticos que llevaban 30 años sin respuesta")).toBe(false);
    expect(isJunk("El Gobierno fijó un tope de 15% para la financiación en pozo")).toBe(false);
    expect(isJunk("OpenAI lanzó un modelo que corre en 2 GB de memoria")).toBe(false);
    // El número es una magnitud, no un conteo de ítems: no es un listicle.
    expect(isJunk("Los 30 años del kernel que cambió la industria")).toBe(false);
    expect(isJunk("La empresa perdió los 500 millones que había levantado")).toBe(false);
  });
});

describe("fromMedia", () => {
  it("se queda solo con lo que habla de algun tema", () => {
    const items = [
      media("Nueva IA de OpenAI resuelve problemas de matemática", "Un sistema de agentes de inteligencia artificial resolvió…"),
      media("River ganó el clásico", "El equipo se impuso 2 a 0 en el Monumental."),
    ];
    const out = fromMedia(items, TOPICS, reputable);
    expect(out).toHaveLength(1);
    expect(out[0].title).toContain("OpenAI");
  });

  it("una sola palabra en comun no alcanza cuando el tema tiene varias", () => {
    // "clientes" aparece, pero el tema pide captación para constructoras.
    const out = fromMedia([media("Los bancos pierden clientes por las comisiones", "Nota sobre bancos.")], TOPICS, reputable);
    expect(out).toHaveLength(0);
  });

  it("marca si hay cuerpo de verdad o solo un resumen minimo", () => {
    const largo = "a".repeat(300);
    const out = fromMedia(
      [media("Inteligencia artificial en la industria", largo), media("Inteligencia artificial y tecnologia", "corto")],
      TOPICS, reputable,
    );
    expect(out.find((c) => c.snippet.length > 200)?.hasBody).toBe(true);
    expect(out.find((c) => c.snippet === "corto")?.hasBody).toBe(false);
  });

  it("filtra la basura antes de mirar el tema", () => {
    expect(fromMedia([media("Las 5 claves de la inteligencia artificial", "x".repeat(300))], TOPICS, reputable)).toHaveLength(0);
  });

  it("marca reputable segun la fuente", () => {
    const out = fromMedia([media("Inteligencia artificial de vanguardia", "y".repeat(200), "BlogRandom")], TOPICS, reputable);
    expect(out[0].reputable).toBe(false);
  });
});

describe("mergeCandidates", () => {
  it("lo que tiene cuerpo va primero", () => {
    const out = mergeCandidates(
      [news("Titular suelto sobre inteligencia artificial")],
      [media("Otra sobre inteligencia artificial y tecnologia", "z".repeat(300))],
      TOPICS, reputable,
    );
    expect(out[0].hasBody).toBe(true);
    expect(out[1].hasBody).toBe(false);
  });

  it("la misma nota no entra dos veces, y gana la version con cuerpo", () => {
    const title = "La inteligencia artificial resolvió un problema de tecnologia";
    const out = mergeCandidates([news(title)], [media(title, "w".repeat(300))], TOPICS, reputable);
    expect(out).toHaveLength(1);
    expect(out[0].hasBody).toBe(true);
  });

  it("ignora mayusculas y puntuacion al comparar titulos", () => {
    const out = mergeCandidates(
      [news("Inteligencia Artificial: avance en tecnologia")],
      [media("inteligencia artificial avance en tecnologia", "q".repeat(300))],
      TOPICS, reputable,
    );
    expect(out).toHaveLength(1);
  });

  it("los candidatos de Google News nunca declaran cuerpo", () => {
    const out = mergeCandidates([news("Algo sobre inteligencia artificial")], [], TOPICS, reputable);
    expect(out.every((c) => !c.hasBody)).toBe(true);
  });

  it("saca la basura tambien de Google News", () => {
    expect(mergeCandidates([news("Los 5 mejores gadgets del año")], [], TOPICS, reputable)).toHaveLength(0);
  });
});
