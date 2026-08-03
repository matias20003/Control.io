import { describe, expect, it } from "vitest";
import {
  RETIREMENT_MONTH,
  TRANSITION_MONTH,
  WEEKLY_ACTS_GOAL,
  scaffoldDose,
  scaffoldNotice,
  streakLabel,
  weeklyStreak,
} from "@/lib/circle-scaffold";

// Mediodía ARG, para que ninguna aserción dependa del corte de medianoche.
function arg(day: string): Date {
  return new Date(`${day}T15:00:00.000Z`);
}

describe("scaffoldDose", () => {
  it("da el andamio entero cuando la persona recién llega", () => {
    const dose = scaffoldDose(arg("2026-08-01"), arg("2026-08-02"));
    expect(dose.phase).toBe("ANDAMIO");
    expect(dose.fullCelebration).toBe(true);
    expect(dose.mirrorFirst).toBe(false);
  });

  it("asume el arranque si nunca se miró al espejo", () => {
    expect(scaffoldDose(null, arg("2026-08-02")).phase).toBe("ANDAMIO");
  });

  it("baja el volumen a los tres meses", () => {
    const dose = scaffoldDose(arg("2026-05-02"), arg("2026-08-02"));
    expect(dose.monthsIn).toBe(TRANSITION_MONTH);
    expect(dose.phase).toBe("TRANSICION");
    expect(dose.fullCelebration).toBe(false);
    expect(dose.showStreak).toBe(true);
  });

  it("no cumple el mes hasta el día que corresponde", () => {
    const dose = scaffoldDose(arg("2026-05-15"), arg("2026-08-02"));
    expect(dose.monthsIn).toBe(2);
    expect(dose.phase).toBe("ANDAMIO");
  });

  it("se retira a los seis meses y pone el espejo adelante", () => {
    const dose = scaffoldDose(arg("2026-02-02"), arg("2026-08-02"));
    expect(dose.monthsIn).toBe(RETIREMENT_MONTH);
    expect(dose.phase).toBe("RETIRO");
    expect(dose.showStreak).toBe(false);
    expect(dose.mirrorFirst).toBe(true);
  });

  it("nunca cuenta meses negativos", () => {
    expect(scaffoldDose(arg("2026-12-01"), arg("2026-08-02")).monthsIn).toBe(0);
  });

  it("el retiro se anuncia en voz alta", () => {
    const notice = scaffoldNotice(scaffoldDose(arg("2026-01-02"), arg("2026-08-02")));
    expect(notice.title).toMatch(/no te necesito/i);
  });

  it("el contrato se declara desde el principio", () => {
    const notice = scaffoldNotice(scaffoldDose(arg("2026-08-01"), arg("2026-08-02")));
    expect(notice.body).toMatch(/nunca cuánto consumís/i);
  });
});

describe("weeklyStreak", () => {
  // 2026-08-02 es domingo: la semana en curso arrancó el lunes 27/07.
  const HOY = arg("2026-08-02");

  function semana(lunes: string, cantidad: number): Date[] {
    return Array.from({ length: cantidad }, (_, i) =>
      arg(`${lunes.slice(0, 8)}${String(Number(lunes.slice(8)) + (i % 5)).padStart(2, "0")}`),
    );
  }

  it("sin actos no hay racha", () => {
    const streak = weeklyStreak([], HOY);
    expect(streak.weeks).toBe(0);
    expect(streak.missing).toBe(WEEKLY_ACTS_GOAL);
    expect(streakLabel(streak)).toBeNull();
  });

  it("cuenta la semana en curso sólo cuando ya llegó al objetivo", () => {
    const casi = weeklyStreak(semana("2026-07-27", WEEKLY_ACTS_GOAL - 1), HOY);
    expect(casi.weeks).toBe(0);
    expect(casi.missing).toBe(1);

    const lograda = weeklyStreak(semana("2026-07-27", WEEKLY_ACTS_GOAL), HOY);
    expect(lograda.weeks).toBe(1);
    expect(lograda.missing).toBe(0);
  });

  it("encadena semanas cerradas consecutivas", () => {
    const actos = [
      ...semana("2026-07-13", WEEKLY_ACTS_GOAL),
      ...semana("2026-07-20", WEEKLY_ACTS_GOAL),
      ...semana("2026-07-27", WEEKLY_ACTS_GOAL),
    ];
    expect(weeklyStreak(actos, HOY).weeks).toBe(3);
  });

  it("una semana en curso floja no borra las semanas ya ganadas", () => {
    const actos = [
      ...semana("2026-07-13", WEEKLY_ACTS_GOAL),
      ...semana("2026-07-20", WEEKLY_ACTS_GOAL),
    ];
    const streak = weeklyStreak(actos, HOY);
    expect(streak.weeks).toBe(2);
    expect(streak.thisWeek).toBe(0);
  });

  it("corta en la primera semana cerrada que no llegó", () => {
    const actos = [
      ...semana("2026-07-06", WEEKLY_ACTS_GOAL),
      // 2026-07-13 vacía: corta acá.
      ...semana("2026-07-20", WEEKLY_ACTS_GOAL),
    ];
    expect(weeklyStreak(actos, HOY).weeks).toBe(1);
  });

  it("un día vacío no cuesta nada", () => {
    // Tres actos el mismo día alcanzan: la racha mide actos, no días abiertos.
    const mismoDia = [arg("2026-07-28"), arg("2026-07-28"), arg("2026-07-28")];
    expect(weeklyStreak(mismoDia, HOY).weeks).toBe(1);
  });

  it("pone el texto en plural sólo cuando corresponde", () => {
    expect(streakLabel({ weeks: 1, thisWeek: 3, missing: 0 })).toBe("1 semana seguida");
    expect(streakLabel({ weeks: 4, thisWeek: 3, missing: 0 })).toBe("4 semanas seguidas");
  });
});
