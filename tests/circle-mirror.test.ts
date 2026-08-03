import { describe, expect, it } from "vitest";
import { buildMirror, type MirrorInput } from "@/lib/circle-mirror";

function input(over: Partial<MirrorInput> = {}): MirrorInput {
  return {
    followedAtStart: null,
    sourcesNow: 0,
    peopleNow: 0,
    conversations: 0,
    conversationsWithMemory: 0,
    habitsAlive: 0,
    tasksDone: 0,
    converted: 0,
    daysWithoutInstagram: null,
    ...over,
  };
}

describe("buildMirror", () => {
  it("sin nada hecho, dice que todavía no en vez de inventar", () => {
    const mirror = buildMirror(input({ sourcesNow: 4 }));
    expect(mirror.isReady).toBe(false);
    expect(mirror.headline).toBeNull();
    expect(mirror.missing).toMatch(/todavía no/i);
  });

  it("leer no alcanza para llenar el espejo", () => {
    // 40 piezas abiertas y nada convertido: no hay cambio que mostrar.
    const mirror = buildMirror(input({ sourcesNow: 9, converted: 0 }));
    expect(mirror.isReady).toBe(false);
  });

  it("compara contra la línea de base del día 1", () => {
    const mirror = buildMirror(
      input({ followedAtStart: 412, sourcesNow: 9, peopleNow: 11, conversations: 14 }),
    );
    const fuentes = mirror.lines.find((line) => line.key === "fuentes");
    expect(fuentes?.before).toBe("412 cuentas");
    expect(fuentes?.after).toBe("9 fuentes");
    expect(fuentes?.detail).toMatch(/403 menos/);
    expect(mirror.headline).toMatch(/412 cuentas a 9 fuentes/);
  });

  it("sin línea de base no inventa un antes", () => {
    const mirror = buildMirror(input({ sourcesNow: 9, conversations: 3 }));
    expect(mirror.lines.find((line) => line.key === "fuentes")?.before).toBeNull();
  });

  it("cuenta lo que sobrevivió, no lo que se convirtió", () => {
    const mirror = buildMirror(
      input({ conversations: 2, converted: 12, habitsAlive: 3, tasksDone: 1 }),
    );
    const vivo = mirror.lines.find((line) => line.key === "vivo");
    expect(vivo?.after).toBe("3 hábitos que seguís y 1 cosa que hiciste");
    expect(vivo?.detail).toMatch(/12 cosas convertidas/);
  });

  it("no muestra líneas vacías", () => {
    const mirror = buildMirror(input({ sourcesNow: 5, conversations: 4 }));
    expect(mirror.lines.some((line) => line.key === "vivo")).toBe(false);
    expect(mirror.lines.some((line) => line.key === "sin-instagram")).toBe(false);
  });

  it("una sola conversación alcanza para que el espejo hable", () => {
    const mirror = buildMirror(input({ conversations: 1, peopleNow: 1 }));
    expect(mirror.isReady).toBe(true);
    expect(mirror.headline).toMatch(/1 conversación que no hubiera pasado/);
  });

  it("destaca las conversaciones que dejaron algo escrito", () => {
    const mirror = buildMirror(
      input({ conversations: 9, conversationsWithMemory: 4, peopleNow: 6 }),
    );
    expect(mirror.lines.find((line) => line.key === "conversaciones")?.detail).toMatch(
      /4 dejaron algo escrito/,
    );
  });

  it("suma los días sin Instagram sólo si cortó", () => {
    const conCorte = buildMirror(
      input({ conversations: 2, daysWithoutInstagram: 21 }),
    );
    expect(conCorte.lines.find((line) => line.key === "sin-instagram")?.after).toBe("21 días");

    const recaida = buildMirror(input({ conversations: 2, daysWithoutInstagram: 0 }));
    expect(recaida.lines.some((line) => line.key === "sin-instagram")).toBe(false);
  });
});
