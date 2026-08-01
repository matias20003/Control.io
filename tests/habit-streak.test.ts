import { describe, expect, it } from "vitest";
import { getHabitStreak, isHabitDue } from "@/lib/habit-streak";

const daily = { frequency: "DAILY", daysOfWeek: [] };
// 2026-08-03 es lunes. Lunes/miércoles/viernes = 1, 3, 5.
const mwf = { frequency: "WEEKLY", daysOfWeek: [1, 3, 5] };

describe("isHabitDue", () => {
  it("un hábito diario toca todos los días", () => {
    expect(isHabitDue("2026-08-04", daily)).toBe(true);
  });

  it("un semanal solo toca los días elegidos", () => {
    expect(isHabitDue("2026-08-03", mwf)).toBe(true); // lunes
    expect(isHabitDue("2026-08-04", mwf)).toBe(false); // martes
    expect(isHabitDue("2026-08-05", mwf)).toBe(true); // miércoles
  });

  it("sin días elegidos se comporta como diario", () => {
    expect(isHabitDue("2026-08-04", { frequency: "WEEKLY", daysOfWeek: [] })).toBe(true);
  });
});

describe("getHabitStreak", () => {
  it("cuenta los días seguidos hasta hoy", () => {
    const streak = getHabitStreak(daily, ["2026-08-05", "2026-08-06", "2026-08-07"], "2026-08-07");
    expect(streak.current).toBe(3);
    expect(streak.doneToday).toBe(true);
  });

  it("el día de hoy sin marcar no corta la racha", () => {
    const streak = getHabitStreak(daily, ["2026-08-05", "2026-08-06"], "2026-08-07");
    expect(streak.current).toBe(2);
    expect(streak.doneToday).toBe(false);
  });

  it("un día salteado sí la corta", () => {
    const streak = getHabitStreak(daily, ["2026-08-04", "2026-08-06"], "2026-08-06");
    expect(streak.current).toBe(1);
  });

  it("recuerda la mejor racha aunque la actual esté cortada", () => {
    const streak = getHabitStreak(
      daily,
      ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-07"],
      "2026-08-07",
    );
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(4);
  });

  it("en un semanal, los días que no tocan no cortan la racha", () => {
    // Lun 3, mié 5 y vie 7 cumplidos: son 3 seguidos aunque falten martes y jueves.
    const streak = getHabitStreak(mwf, ["2026-08-03", "2026-08-05", "2026-08-07"], "2026-08-07");
    expect(streak.current).toBe(3);
  });

  it("calcula el cumplimiento sobre los días que tocaban", () => {
    // Ventana de 7 días hasta el viernes 7: tocaban lun 3, mié 5 y vie 7.
    const streak = getHabitStreak(mwf, ["2026-08-03", "2026-08-07"], "2026-08-07", 7);
    expect(streak.rate).toBe(67);
  });

  it("un hábito sin historial no rompe nada", () => {
    const streak = getHabitStreak(daily, [], "2026-08-07");
    expect(streak).toMatchObject({ current: 0, best: 0, rate: 0, doneToday: false, dueToday: true });
  });
});
