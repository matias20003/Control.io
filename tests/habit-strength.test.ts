import { describe, expect, it } from "vitest";
import { getHabitStreak, habitStrength } from "@/lib/habit-streak";

const DAILY = { frequency: "DAILY", daysOfWeek: [] };
const HOY = "2026-08-05";

/** Los N días anteriores a `hasta`, incluido, como claves YYYY-MM-DD. */
function days(count: number, hasta = HOY): string[] {
  const end = new Date(`${hasta}T00:00:00.000Z`).getTime();
  return Array.from({ length: count }, (_, i) =>
    new Date(end - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

describe("habitStrength", () => {
  it("sin historial la fuerza es cero", () => {
    expect(habitStrength(DAILY, [], HOY)).toBe(0);
  });

  it("crece cuanto más largo es el tramo cumplido", () => {
    const corto = habitStrength(DAILY, days(5), HOY);
    const largo = habitStrength(DAILY, days(40), HOY);
    expect(corto).toBeGreaterThan(0);
    expect(largo).toBeGreaterThan(corto);
  });

  it("faltar un día baja la fuerza pero no la desploma", () => {
    const completo = days(40);
    const conFalta = completo.filter((day) => day !== "2026-08-03");
    const antes = habitStrength(DAILY, completo, HOY);
    const despues = habitStrength(DAILY, conFalta, HOY);

    expect(despues).toBeLessThan(antes);
    // Lo que la racha clásica haría acá es volver a 1. El puntaje conserva casi
    // todo: es la diferencia entre "perdiste todo" y "perdiste un día".
    expect(despues).toBeGreaterThan(antes * 0.8);
  });

  it("el día de hoy sin marcar todavía no descuenta", () => {
    const hastaAyer = days(30, "2026-08-04");
    // Mirado ayer y mirado hoy (con hoy aún en curso) da lo mismo.
    expect(habitStrength(DAILY, hastaAyer, HOY)).toBe(habitStrength(DAILY, hastaAyer, "2026-08-04"));
  });

  it("una semana entera sin hacerlo sí se nota", () => {
    const viejo = days(40, "2026-07-25");
    expect(habitStrength(DAILY, viejo, HOY)).toBeLessThan(habitStrength(DAILY, days(40), HOY) / 2);
  });

  it("solo cuentan los días que tocaban", () => {
    // Lunes y miércoles. Cumplir todos los lunes y miércoles es fuerza plena,
    // aunque el resto de la semana no haga nada.
    const lunesYMiercoles = { frequency: "WEEKLY", daysOfWeek: [1, 3] };
    const cumplidos = days(120).filter((day) => {
      const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay();
      return weekday === 1 || weekday === 3;
    });
    expect(habitStrength(lunesYMiercoles, cumplidos, HOY)).toBeGreaterThan(95);
  });
});

describe("getHabitStreak", () => {
  it("expone la fuerza junto a la racha", () => {
    const streak = getHabitStreak(DAILY, days(20), HOY);
    expect(streak.current).toBe(20);
    expect(streak.strength).toBeGreaterThan(50);
  });

  it("tras una falta la racha se corta pero la fuerza sobrevive", () => {
    const conFalta = days(30).filter((day) => day !== "2026-08-01");
    const streak = getHabitStreak(DAILY, conFalta, HOY);
    expect(streak.current).toBe(4);          // se cortó el 1 de agosto
    expect(streak.strength).toBeGreaterThan(70); // el hábito sigue firme
  });
});
