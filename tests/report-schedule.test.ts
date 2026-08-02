import { describe, expect, it } from "vitest";
import { isReportDue } from "@/lib/reports/schedule";

/**
 * `now` llega ya convertido a hora argentina, así que los getters locales de
 * Date son los que corresponden. Por eso los tests construyen fechas locales.
 */
const at = (year: number, month: number, day: number) => new Date(year, month - 1, day);

describe("isReportDue · semanal", () => {
  // Agosto 2026: el 3 es lunes, el 4 martes, el 9 domingo.
  it("sale el día de la semana elegido", () => {
    expect(isReportDue("WEEKLY", 1, at(2026, 8, 3))).toBe(true); // lunes
  });

  it("no sale los otros días", () => {
    expect(isReportDue("WEEKLY", 1, at(2026, 8, 4))).toBe(false);
    expect(isReportDue("WEEKLY", 1, at(2026, 8, 9))).toBe(false);
  });

  it("respeta el domingo como día 0", () => {
    expect(isReportDue("WEEKLY", 0, at(2026, 8, 9))).toBe(true);
    expect(isReportDue("WEEKLY", 0, at(2026, 8, 3))).toBe(false);
  });

  it("sale todas las semanas, no una sola vez", () => {
    expect(isReportDue("WEEKLY", 1, at(2026, 8, 10))).toBe(true);
    expect(isReportDue("WEEKLY", 1, at(2026, 8, 17))).toBe(true);
  });
});

describe("isReportDue · quincenal", () => {
  it("con día 15 sale el 15 y el último del mes", () => {
    expect(isReportDue("FORTNIGHTLY", 15, at(2026, 8, 15))).toBe(true);
    expect(isReportDue("FORTNIGHTLY", 15, at(2026, 8, 31))).toBe(true);
    expect(isReportDue("FORTNIGHTLY", 15, at(2026, 8, 20))).toBe(false);
  });

  it("con día 1 sale el 1 y el 16", () => {
    expect(isReportDue("FORTNIGHTLY", 1, at(2026, 8, 1))).toBe(true);
    expect(isReportDue("FORTNIGHTLY", 1, at(2026, 8, 16))).toBe(true);
    expect(isReportDue("FORTNIGHTLY", 1, at(2026, 8, 15))).toBe(false);
  });

  it("el último del mes se ajusta a meses cortos", () => {
    // Febrero 2026 tiene 28 días: el segundo envío cae el 28, no el 30.
    expect(isReportDue("FORTNIGHTLY", 15, at(2026, 2, 28))).toBe(true);
    expect(isReportDue("FORTNIGHTLY", 15, at(2026, 4, 30))).toBe(true);
  });
});

describe("isReportDue · mensual", () => {
  it("sale el día elegido", () => {
    expect(isReportDue("MONTHLY", 10, at(2026, 8, 10))).toBe(true);
    expect(isReportDue("MONTHLY", 10, at(2026, 8, 11))).toBe(false);
  });

  it("un 31 en un mes corto cae el último día, no se saltea el mes", () => {
    expect(isReportDue("MONTHLY", 31, at(2026, 2, 28))).toBe(true);
    expect(isReportDue("MONTHLY", 31, at(2026, 4, 30))).toBe(true);
    expect(isReportDue("MONTHLY", 31, at(2026, 8, 31))).toBe(true);
  });

  it("sin día configurado usa el 1", () => {
    expect(isReportDue("MONTHLY", null, at(2026, 8, 1))).toBe(true);
    expect(isReportDue("MONTHLY", null, at(2026, 8, 2))).toBe(false);
  });
});
