import { describe, expect, it } from "vitest";
import { percentageOf, getInitials } from "@/lib/utils";

describe("percentageOf — porcentaje usado de un presupuesto/meta", () => {
  it("calcula el porcentaje redondeado", () => {
    expect(percentageOf(50, 200)).toBe(25);
    expect(percentageOf(1, 3)).toBe(33);
    expect(percentageOf(2, 3)).toBe(67);
  });

  it("100% cuando se consume todo", () => {
    expect(percentageOf(200, 200)).toBe(100);
  });

  it("puede superar 100% (presupuesto excedido)", () => {
    expect(percentageOf(300, 200)).toBe(150);
  });

  it("total 0 → 0% (evita división por cero)", () => {
    expect(percentageOf(50, 0)).toBe(0);
  });
});

describe("getInitials — iniciales para avatares", () => {
  it("toma la inicial de las primeras dos palabras", () => {
    expect(getInitials("Ana Gómez")).toBe("AG");
  });

  it("un solo nombre → una inicial", () => {
    expect(getInitials("Beto")).toBe("B");
  });

  it("ignora palabras a partir de la tercera", () => {
    expect(getInitials("Juan Carlos Pérez")).toBe("JC");
  });
});
