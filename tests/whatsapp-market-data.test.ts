import { describe, expect, it } from "vitest";
import { formatMarketReply, parseMarketQuery } from "@/lib/whatsapp/market-data";

const rates = [
  { moneda: "USD", casa: "blue", nombre: "Blue", compra: 1300, venta: 1320, fetchedAt: "2026-07-30T15:00:00.000Z" },
  { moneda: "USD", casa: "oficial", nombre: "Oficial", compra: 1100, venta: 1140, fetchedAt: "2026-07-30T15:00:00.000Z" },
];

describe("consultas de mercado por WhatsApp", () => {
  it("detecta una consulta del dólar blue", () => {
    expect(parseMarketQuery("¿A cuánto está el dólar blue hoy?")).toEqual({
      currency: "USD",
      type: "blue",
      amount: undefined,
    });
  });

  it("responde la frase exacta usada en WhatsApp sin pedir un tipo", () => {
    expect(parseMarketQuery("a cuanto esta el dolar")).toEqual({
      currency: "USD",
      type: undefined,
      amount: undefined,
    });
    const reply = formatMarketReply({ currency: "USD" }, rates);
    expect(reply).toContain("Blue");
    expect(reply).toContain("Oficial");
    expect(reply).not.toContain("controlio.site");
  });

  it("detecta conversión de dólares", () => {
    expect(parseMarketQuery("¿Cuánto valen 100 USD al blue?")).toEqual({
      currency: "USD",
      type: "blue",
      amount: 100,
    });
  });

  it("formatea compra, venta y fuente", () => {
    const reply = formatMarketReply({ currency: "USD", type: "blue" }, rates);
    expect(reply).toContain("compra");
    expect(reply).toContain("venta");
    expect(reply).toContain("DolarAPI");
  });

  it("convierte usando la punta vendedora", () => {
    const reply = formatMarketReply({ currency: "USD", type: "blue", amount: 100 }, rates);
    expect(reply).toContain("132.000");
  });
});
