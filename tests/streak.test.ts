import { describe, expect, it } from "vitest";
import { calculateStreak } from "@/lib/streak-utils";

const days = (...d: string[]) => new Set(d);

describe("calculateStreak — días consecutivos registrando", () => {
  const HOY = "2026-06-12";

  it("sin días activos → 0", () => {
    expect(calculateStreak(days(), HOY)).toBe(0);
  });

  it("solo hoy → 1", () => {
    expect(calculateStreak(days("2026-06-12"), HOY)).toBe(1);
  });

  it("hoy + ayer + anteayer → 3", () => {
    expect(calculateStreak(days("2026-06-12", "2026-06-11", "2026-06-10"), HOY)).toBe(3);
  });

  it("la racha sigue viva si cargó ayer pero hoy todavía no", () => {
    expect(calculateStreak(days("2026-06-11", "2026-06-10"), HOY)).toBe(2);
  });

  it("rota si el último día fue anteayer (saltó ayer)", () => {
    expect(calculateStreak(days("2026-06-10", "2026-06-09"), HOY)).toBe(0);
  });

  it("corta en el primer hueco (no cuenta días anteriores al hueco)", () => {
    // hoy, ayer, [hueco anteayer], y más viejos → racha = 2
    expect(calculateStreak(days("2026-06-12", "2026-06-11", "2026-06-09", "2026-06-08"), HOY)).toBe(2);
  });

  it("cruza fin de mes correctamente", () => {
    const hoy = "2026-07-01";
    expect(calculateStreak(days("2026-07-01", "2026-06-30", "2026-06-29"), hoy)).toBe(3);
  });

  it("días duplicados/desordenados no afectan (es un Set)", () => {
    expect(calculateStreak(days("2026-06-11", "2026-06-12", "2026-06-12"), HOY)).toBe(2);
  });
});
