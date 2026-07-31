import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { closedPeriod, frequencyLabel, type PeriodicReportSnapshot } from "@/lib/reports/periodic";
import { renderPeriodicReportPdf } from "@/lib/reports/pdf";

describe("periodic reports", () => {
  it("builds closed periods with the correct duration", () => {
    const now = new Date("2026-07-30T15:00:00-03:00");
    expect(Math.round((closedPeriod("WEEKLY", now).end.getTime() - closedPeriod("WEEKLY", now).start.getTime() + 1) / 86_400_000)).toBe(7);
    expect(Math.round((closedPeriod("FORTNIGHTLY", now).end.getTime() - closedPeriod("FORTNIGHTLY", now).start.getTime() + 1) / 86_400_000)).toBe(15);
    expect(Math.round((closedPeriod("MONTHLY", now).end.getTime() - closedPeriod("MONTHLY", now).start.getTime() + 1) / 86_400_000)).toBe(30);
  });

  it("uses human labels", () => {
    expect(frequencyLabel("WEEKLY")).toBe("semanal");
    expect(frequencyLabel("FORTNIGHTLY")).toBe("quincenal");
    expect(frequencyLabel("MONTHLY")).toBe("mensual");
  });

  it("renders a valid three-page A4 PDF", async () => {
    const snapshot: PeriodicReportSnapshot = {
      name: "Usuario", frequency: "WEEKLY",
      periodStart: "2026-07-20T03:00:00.000Z", periodEnd: "2026-07-27T02:59:59.999Z",
      income: 100000, expense: 60000, balance: 40000, savingsRate: 40,
      transactionCount: 2, avgDailyExpense: 8571, previousExpense: 70000,
      previousIncome: 90000, expenseChange: -14, incomeChange: 11,
      categories: [{ name: "Comida", total: 60000, percentage: 100, count: 1, color: "#ef4444" }],
      days: [{ date: "2026-07-21", income: 100000, expense: 60000 }],
      topExpenses: [{ description: "Supermercado", category: "Comida", amount: 60000, date: "2026-07-21" }],
      insights: ["Tus gastos bajaron frente al período anterior."],
    };
    const bytes = await renderPeriodicReportPdf(snapshot);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(3);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(595.28, 1);
  });
});
