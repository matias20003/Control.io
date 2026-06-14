import { describe, expect, it } from "vitest";
import { parseAmount, parseDate, detectColumns } from "@/lib/import-utils";

describe("parseAmount", () => {
  it("formato argentino (punto miles, coma decimal)", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("$ 1.500,00")).toBe(1500);
    expect(parseAmount("12.345.678,90")).toBe(12345678.9);
  });

  it("formato US (coma miles, punto decimal)", () => {
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("1,000")).toBe(1000);
  });

  it("negativos: signo y paréntesis", () => {
    expect(parseAmount("-500,50")).toBe(-500.5);
    expect(parseAmount("(1.200,00)")).toBe(-1200);
  });

  it("enteros y decimales simples", () => {
    expect(parseAmount("5000")).toBe(5000);
    expect(parseAmount("1,50")).toBe(1.5);
    expect(parseAmount("1500")).toBe(1500);
  });

  it("vacío / inválido → null", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe("parseDate", () => {
  it("dd/mm/aaaa argentino", () => {
    expect(parseDate("05/03/2026")).toBe("2026-03-05");
    expect(parseDate("5/3/2026")).toBe("2026-03-05");
  });

  it("ISO aaaa-mm-dd", () => {
    expect(parseDate("2026-03-05")).toBe("2026-03-05");
  });

  it("dd-mm-aa (2 dígitos de año)", () => {
    expect(parseDate("05-03-26")).toBe("2026-03-05");
  });

  it("inválida → null", () => {
    expect(parseDate("no es fecha")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("detectColumns", () => {
  it("detecta columnas de MercadoPago", () => {
    const cols = detectColumns(["Fecha", "Descripción", "Monto", "Saldo"]);
    expect(cols.date).toBe("Fecha");
    expect(cols.description).toBe("Descripción");
    expect(cols.amount).toBe("Monto");
  });

  it("detecta débito/crédito separados", () => {
    const cols = detectColumns(["Fecha", "Detalle", "Débito", "Crédito"]);
    expect(cols.date).toBe("Fecha");
    expect(cols.description).toBe("Detalle");
    expect(cols.debit).toBe("Débito");
    expect(cols.credit).toBe("Crédito");
  });

  it("sin coincidencias → null", () => {
    const cols = detectColumns(["col1", "col2"]);
    expect(cols.date).toBeNull();
    expect(cols.amount).toBeNull();
  });
});
