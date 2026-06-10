import { describe, expect, it } from "vitest";
import { averageRate, amountToArs } from "@/lib/exchange-utils";

describe("averageRate — promedio compra/venta del blue", () => {
  it("promedia ambas puntas", () => {
    expect(averageRate(1000, 1050)).toBe(1025);
  });

  it("si falta la compra, usa la venta", () => {
    expect(averageRate(0, 1050)).toBe(1050);
  });

  it("si falta la venta, usa la compra", () => {
    expect(averageRate(1000, 0)).toBe(1000);
  });

  it("ambas en 0 o negativas → null (no hay cotización usable)", () => {
    expect(averageRate(0, 0)).toBeNull();
    expect(averageRate(-5, -3)).toBeNull();
  });
});

describe("amountToArs — conversión de un monto a ARS", () => {
  it("ARS se mantiene igual, con rate 1", () => {
    expect(amountToArs(5000, "ARS", null)).toEqual({
      amountARS: 5000,
      exchangeRate: 1,
    });
  });

  it("USD con rate multiplica monto × rate", () => {
    expect(amountToArs(100, "USD", 1025)).toEqual({
      amountARS: 102500,
      exchangeRate: 1025,
    });
  });

  it("USD sin rate disponible → null (no inventamos un valor)", () => {
    expect(amountToArs(100, "USD", null)).toEqual({
      amountARS: null,
      exchangeRate: null,
    });
  });

  it("moneda no soportada → null", () => {
    expect(amountToArs(100, "EUR", 1100)).toEqual({
      amountARS: null,
      exchangeRate: null,
    });
  });
});
