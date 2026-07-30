import { describe, expect, it } from "vitest";
import { calculateTransferConversion } from "@/lib/transfer-conversion";

describe("calculateTransferConversion", () => {
  it("vende USD y acredita ARS multiplicando por la cotización", () => {
    expect(calculateTransferConversion(100, "USD", "ARS", 1350)).toMatchObject({
      destinationAmount: 135000,
      exchangeRate: 1350,
      rateBaseCurrency: "USD",
      rateQuoteCurrency: "ARS",
    });
  });

  it("usa ARS para comprar USD dividiendo por la cotización", () => {
    expect(calculateTransferConversion(135000, "ARS", "USD", 1350).destinationAmount).toBe(100);
  });

  it("mantiene el importe en transferencias de la misma moneda", () => {
    expect(calculateTransferConversion(250.25, "ARS", "ARS").destinationAmount).toBe(250.25);
  });

  it("redondea el importe acreditado a centavos", () => {
    expect(calculateTransferConversion(1000, "ARS", "USD", 1350).destinationAmount).toBe(0.74);
  });

  it("rechaza pares todavía no soportados", () => {
    expect(() => calculateTransferConversion(100, "EUR", "USD", 1.1)).toThrow(/pesos argentinos/);
  });

  it("convierte ARS a EUR usando ARS por euro", () => {
    expect(calculateTransferConversion(170000, "ARS", "EUR", 1700).destinationAmount).toBe(100);
  });

  it("conserva ocho decimales al comprar bitcoin", () => {
    expect(calculateTransferConversion(100000, "ARS", "BTC", 150000000).destinationAmount).toBe(0.00066667);
  });
});
