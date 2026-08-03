import { describe, expect, it } from "vitest";
import { normalizeSearchRange, searchWindow } from "@/lib/search-range";

describe("normalizeSearchRange", () => {
  it("deja pasar un rango completo", () => {
    expect(normalizeSearchRange({ from: "2026-07-01", to: "2026-07-31" })).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });

  it("da vuelta el rango invertido en vez de no devolver nada", () => {
    expect(normalizeSearchRange({ from: "2026-07-31", to: "2026-07-01" })).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });

  it("ignora las fechas a medio tipear", () => {
    expect(normalizeSearchRange({ from: "2026-07", to: "2026-07-31" })).toEqual({
      from: undefined,
      to: "2026-07-31",
    });
  });

  it("sin rango no inventa fechas", () => {
    expect(normalizeSearchRange()).toEqual({ from: undefined, to: undefined });
  });
});

describe("searchWindow", () => {
  const now = new Date("2026-08-03T15:00:00.000Z");

  it("toma el día entero elegido, de punta a punta", () => {
    const { since, until } = searchWindow({ from: "2026-07-01", to: "2026-07-31" }, now);
    expect(since.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    // 23:59:59.999 y no medianoche del 1/8: un movimiento del 31 a la tarde
    // tiene que entrar.
    expect(until?.toISOString()).toBe("2026-07-31T23:59:59.999Z");
  });

  it("sin desde, la ventana son los últimos 6 meses", () => {
    const { since, until } = searchWindow({}, now);
    expect(since.toISOString().slice(0, 10)).toBe("2026-02-03");
    expect(until).toBeNull();
  });

  it("con desde puede ir mas atras de esos 6 meses", () => {
    const { since } = searchWindow({ from: "2024-01-15" }, now);
    expect(since.toISOString()).toBe("2024-01-15T00:00:00.000Z");
  });

  it("solo hasta, sin desde, mantiene el piso de 6 meses", () => {
    const { since, until } = searchWindow({ to: "2026-06-30" }, now);
    expect(since.toISOString().slice(0, 10)).toBe("2026-02-03");
    expect(until?.toISOString()).toBe("2026-06-30T23:59:59.999Z");
  });
});
