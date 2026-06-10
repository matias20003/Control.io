import { describe, expect, it } from "vitest";
import {
  calcularBalances,
  calcularLiquidacion,
  type SerializedMiembro,
  type SerializedGasto,
} from "@/lib/db/grupos-utils";

// Helpers para armar fixtures legibles
const miembro = (id: string, nombre: string): SerializedMiembro => ({
  id,
  nombre,
  email: null,
  userId: null,
  esCreador: false,
  uniEn: "2025-01-01T00:00:00.000Z",
});

const gasto = (
  id: string,
  monto: number,
  pagadoPorId: string,
  divisiones: { miembroId: string; monto: number }[]
): SerializedGasto => ({
  id,
  descripcion: id,
  monto,
  pagadoPorId,
  pagadoPorNombre: pagadoPorId,
  fecha: "2025-01-01T00:00:00.000Z",
  divisiones: divisiones.map((d, i) => ({ id: `${id}-${i}`, ...d })),
});

describe("calcularBalances", () => {
  it("dividido en partes iguales entre 2: el que pagó queda +mitad, el otro -mitad", () => {
    const miembros = [miembro("a", "Ana"), miembro("b", "Beto")];
    // Ana paga 1000, se divide 500/500
    const gastos = [
      gasto("g1", 1000, "a", [
        { miembroId: "a", monto: 500 },
        { miembroId: "b", monto: 500 },
      ]),
    ];
    const balances = calcularBalances(miembros, gastos);
    expect(balances.find((b) => b.miembroId === "a")!.balance).toBe(500);
    expect(balances.find((b) => b.miembroId === "b")!.balance).toBe(-500);
  });

  it("la suma de todos los balances es 0 (nadie pierde ni gana plata del aire)", () => {
    const miembros = [miembro("a", "A"), miembro("b", "B"), miembro("c", "C")];
    const gastos = [
      gasto("g1", 900, "a", [
        { miembroId: "a", monto: 300 },
        { miembroId: "b", monto: 300 },
        { miembroId: "c", monto: 300 },
      ]),
      gasto("g2", 300, "b", [
        { miembroId: "a", monto: 150 },
        { miembroId: "b", monto: 150 },
      ]),
    ];
    const balances = calcularBalances(miembros, gastos);
    const suma = balances.reduce((s, b) => s + b.balance, 0);
    expect(Math.abs(suma)).toBeLessThan(1e-9);
  });

  it("división custom: respeta los montos exactos de cada división", () => {
    const miembros = [miembro("a", "A"), miembro("b", "B")];
    // A paga 1000 pero B solo debe 200 (custom)
    const gastos = [
      gasto("g1", 1000, "a", [
        { miembroId: "a", monto: 800 },
        { miembroId: "b", monto: 200 },
      ]),
    ];
    const balances = calcularBalances(miembros, gastos);
    expect(balances.find((b) => b.miembroId === "a")!.balance).toBe(200);
    expect(balances.find((b) => b.miembroId === "b")!.balance).toBe(-200);
  });

  it("sin gastos, todos los balances en 0", () => {
    const miembros = [miembro("a", "A"), miembro("b", "B")];
    const balances = calcularBalances(miembros, []);
    expect(balances.every((b) => b.balance === 0)).toBe(true);
  });
});

describe("calcularLiquidacion", () => {
  it("caso simple: B le paga a A lo que le debe", () => {
    const balances = [
      { miembroId: "a", nombre: "A", balance: 500 },
      { miembroId: "b", nombre: "B", balance: -500 },
    ];
    const pagos = calcularLiquidacion(balances);
    expect(pagos).toHaveLength(1);
    expect(pagos[0]).toMatchObject({
      deudorId: "b",
      acreedorId: "a",
      monto: 500,
    });
  });

  it("la suma de pagos iguala la deuda total (no se pierde plata en la liquidación)", () => {
    const balances = [
      { miembroId: "a", nombre: "A", balance: 700 },
      { miembroId: "b", nombre: "B", balance: -300 },
      { miembroId: "c", nombre: "C", balance: -400 },
    ];
    const pagos = calcularLiquidacion(balances);
    const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
    expect(totalPagado).toBeCloseTo(700, 2);
    // Cada deudor paga exactamente lo que debe
    const pagaB = pagos.filter((p) => p.deudorId === "b").reduce((s, p) => s + p.monto, 0);
    const pagaC = pagos.filter((p) => p.deudorId === "c").reduce((s, p) => s + p.monto, 0);
    expect(pagaB).toBeCloseTo(300, 2);
    expect(pagaC).toBeCloseTo(400, 2);
  });

  it("minimiza transferencias: 3 personas se saldan sin pagos redundantes", () => {
    // A +100, B -100, C 0 → un solo pago B→A
    const balances = [
      { miembroId: "a", nombre: "A", balance: 100 },
      { miembroId: "b", nombre: "B", balance: -100 },
      { miembroId: "c", nombre: "C", balance: 0 },
    ];
    const pagos = calcularLiquidacion(balances);
    expect(pagos).toHaveLength(1);
  });

  it("ignora diferencias de centavos (< 0.01) para no generar pagos fantasma", () => {
    const balances = [
      { miembroId: "a", nombre: "A", balance: 0.005 },
      { miembroId: "b", nombre: "B", balance: -0.005 },
    ];
    const pagos = calcularLiquidacion(balances);
    expect(pagos).toHaveLength(0);
  });

  it("todos saldados (balances en 0) → sin pagos", () => {
    const balances = [
      { miembroId: "a", nombre: "A", balance: 0 },
      { miembroId: "b", nombre: "B", balance: 0 },
    ];
    expect(calcularLiquidacion(balances)).toHaveLength(0);
  });
});
