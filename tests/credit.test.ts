import { describe, expect, it } from "vitest";
import { splitInstallments } from "@/lib/db/credit-utils";

// Suma con tolerancia a flotantes
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe("splitInstallments — división de un total en cuotas", () => {
  it("divide exacto cuando no hay redondeo (1200 en 3 → 400 c/u)", () => {
    const cuotas = splitInstallments(1200, 3);
    expect(cuotas).toEqual([400, 400, 400]);
  });

  it("la última cuota absorbe el redondeo (1000 en 3 → 333.33, 333.33, 333.34)", () => {
    const cuotas = splitInstallments(1000, 3);
    expect(cuotas).toEqual([333.33, 333.33, 333.34]);
    expect(sum(cuotas)).toBeCloseTo(1000, 10);
  });

  it("la suma SIEMPRE da el total exacto, para varios casos difíciles", () => {
    const casos: [number, number][] = [
      [1000, 3],
      [100, 7],
      [99.99, 4],
      [0.1, 3],
      [1234.56, 12],
      [50, 6],
      [10, 3],
      [1, 7],
    ];
    for (const [total, n] of casos) {
      const cuotas = splitInstallments(total, n);
      expect(cuotas).toHaveLength(n);
      // Suma a 2 decimales debe igualar el total a 2 decimales
      expect(parseFloat(sum(cuotas).toFixed(2))).toBe(parseFloat(total.toFixed(2)));
    }
  });

  it("una sola cuota es el total completo", () => {
    expect(splitInstallments(777.77, 1)).toEqual([777.77]);
  });

  it("0 o menos cuotas → array vacío (no rompe)", () => {
    expect(splitInstallments(1000, 0)).toEqual([]);
    expect(splitInstallments(1000, -2)).toEqual([]);
  });

  it("todas las cuotas tienen como máximo 2 decimales", () => {
    const cuotas = splitInstallments(1000, 7);
    for (const c of cuotas) {
      expect(c).toBe(parseFloat(c.toFixed(2)));
    }
  });

  it("total 0 → todas las cuotas en 0", () => {
    expect(splitInstallments(0, 4)).toEqual([0, 0, 0, 0]);
  });
});
