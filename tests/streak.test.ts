import { describe, expect, it } from "vitest";
import { calculateStreak, calculateLongestStreak, nextStreakMilestone, isStreakMilestone } from "@/lib/streak-utils";

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

describe("calculateLongestStreak — récord histórico", () => {
  it("sin días → 0", () => {
    expect(calculateLongestStreak(days())).toBe(0);
  });

  it("toma la corrida más larga, no la actual", () => {
    // corrida de 4 (1-4 jun) y otra de 2 (10-11 jun) → récord 4
    expect(calculateLongestStreak(days(
      "2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04",
      "2026-06-10", "2026-06-11",
    ))).toBe(4);
  });

  it("un solo día → 1", () => {
    expect(calculateLongestStreak(days("2026-06-05"))).toBe(1);
  });

  it("cruza fin de mes", () => {
    expect(calculateLongestStreak(days("2026-06-29", "2026-06-30", "2026-07-01"))).toBe(3);
  });
});

describe("milestones de racha", () => {
  it("nextStreakMilestone devuelve el próximo hito", () => {
    expect(nextStreakMilestone(1)).toBe(3);
    expect(nextStreakMilestone(7)).toBe(14);
    expect(nextStreakMilestone(30)).toBe(60);
  });

  it("nextStreakMilestone null si superó todos", () => {
    expect(nextStreakMilestone(400)).toBeNull();
  });

  it("isStreakMilestone reconoce los hitos", () => {
    expect(isStreakMilestone(7)).toBe(true);
    expect(isStreakMilestone(8)).toBe(false);
  });
});
