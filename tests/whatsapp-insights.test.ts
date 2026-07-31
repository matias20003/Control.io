import { describe, expect, it } from "vitest";
import { detectFinancialInsights } from "@/lib/whatsapp/insights";

const now = new Date("2026-07-30T15:00:00.000Z");

describe("motor de insights financieros", () => {
  it("detecta un gasto reciente fuera de lo habitual", () => {
    const rows = [
      { amount: 3000, description: "Café", category: "Comida", date: new Date("2026-07-20") },
      { amount: 4000, description: "Almuerzo", category: "Comida", date: new Date("2026-07-21") },
      { amount: 3500, description: "Uber", category: "Transporte", date: new Date("2026-07-22") },
      { amount: 30000, description: "Cena", category: "Comida", date: new Date("2026-07-30T10:00:00Z") },
    ];
    expect(detectFinancialInsights(rows, now).some((item) => item.key.startsWith("anomaly:"))).toBe(true);
  });

  it("detecta una posible suscripción mensual estable", () => {
    const rows = [
      { amount: 9000, description: "Netflix", category: "Servicios", date: new Date("2026-05-05") },
      { amount: 9200, description: "Netflix", category: "Servicios", date: new Date("2026-06-05") },
      { amount: 9400, description: "Netflix", category: "Servicios", date: new Date("2026-07-05") },
    ];
    expect(detectFinancialInsights(rows, now).some((item) => item.key === "recurring:netflix")).toBe(true);
  });
});
