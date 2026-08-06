import { describe, expect, it } from "vitest";
import { convertPositions, netWorthSeries, type CurrencyPosition } from "@/lib/net-worth";

const position = (currency: string, assets: number, liabilities = 0): CurrencyPosition => ({
  currency, assets, liabilities, net: assets - liabilities,
});

describe("convertPositions", () => {
  it("el peso vale uno y no necesita cotizacion", () => {
    expect(convertPositions([position("ARS", 1000, 200)], {})).toEqual({
      assets: 1000, liabilities: 200, net: 800, missing: 0,
    });
  });

  it("suma las otras monedas convertidas, que es lo que faltaba en el Inicio", () => {
    // El bug real: el Inicio mostraba 269.385 (solo pesos) y Finanzas 316.645
    // (pesos + dolares convertidos). Este test fija que el total los incluya.
    const totals = convertPositions(
      [position("ARS", 269_385), position("USD", 40)],
      { USD: 1181.5 },
    );
    expect(totals.net).toBeCloseTo(269_385 + 40 * 1181.5, 2);
  });

  it("una moneda sin cotizacion no se cuenta como cero: se avisa", () => {
    const totals = convertPositions([position("ARS", 1000), position("USD", 100)], {});
    expect(totals.net).toBe(1000);
    expect(totals.missing).toBe(1);
  });

  it("una cotizacion invalida cuenta como faltante", () => {
    expect(convertPositions([position("USD", 100)], { USD: 0 }).missing).toBe(1);
    expect(convertPositions([position("USD", 100)], { USD: -5 }).missing).toBe(1);
    expect(convertPositions([position("USD", 100)], { USD: NaN }).missing).toBe(1);
  });

  it("los pasivos en moneda extranjera tambien se convierten", () => {
    const totals = convertPositions([position("USD", 100, 40)], { USD: 1000 });
    expect(totals.assets).toBe(100_000);
    expect(totals.liabilities).toBe(40_000);
    expect(totals.net).toBe(60_000);
  });
});

describe("netWorthSeries", () => {
  it("el ultimo punto es el patrimonio de hoy, que es el unico dato real", () => {
    const series = netWorthSeries(
      [{ label: "jun", balance: 100 }, { label: "jul", balance: 50 }],
      1000,
    );
    expect(series[series.length - 1].patrimonio).toBe(1000);
  });

  it("cada punto es el patrimonio al cierre de ese mes", () => {
    // Hoy hay 1000. Julio dejó 50, así que junio cerró en 950; junio dejó 100,
    // así que mayo cerró en 850. Lo que dejó mayo ya no mueve ningún punto
    // dibujado: sólo diría cuánto había en abril, que no está en la serie.
    const series = netWorthSeries(
      [{ label: "may", balance: 200 }, { label: "jun", balance: 100 }, { label: "jul", balance: 50 }],
      1000,
    );
    expect(series.map((point) => point.patrimonio)).toEqual([850, 950, 1000]);
  });

  it("un mes en rojo deja el punto anterior mas alto", () => {
    // Julio perdió 300 y hoy quedan 700: junio tenía que cerrar en 1000.
    const series = netWorthSeries([{ label: "jun", balance: 0 }, { label: "jul", balance: -300 }], 700);
    expect(series[0].patrimonio).toBe(1000);
    expect(series[0].patrimonio).toBeGreaterThan(series[1].patrimonio);
  });

  it("sin meses no hay serie", () => {
    expect(netWorthSeries([], 1000)).toEqual([]);
  });

  it("conserva las etiquetas en orden", () => {
    const series = netWorthSeries([{ label: "may", balance: 1 }, { label: "jun", balance: 2 }], 10);
    expect(series.map((point) => point.label)).toEqual(["may", "jun"]);
  });
});
