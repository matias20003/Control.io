import { describe, expect, it } from "vitest";
import { getNextDueDate, getRecurringOccurrences, isRecurringDue } from "@/lib/recurrence-schedule";

const day = (iso: string) => new Date(`${iso}T12:00:00-03:00`);
/** Igual que guarda la app un "YYYY-MM-DD" del formulario: medianoche UTC. */
const stored = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Igual que startOfTodayArg(): medianoche argentina expresada en UTC. */
const argToday = (iso: string) => new Date(`${iso}T03:00:00.000Z`);

describe("getRecurringOccurrences", () => {
  it("includes a monthly recurring income created for today", () => {
    const dates = getRecurringOccurrences(
      {
        frequency: "MONTHLY",
        dayOfMonth: null,
        startDate: day("2026-07-30"),
        endDate: null,
        lastExecuted: null,
      },
      day("2026-07-30"),
      day("2026-08-29")
    );

    expect(dates.map((date) => date.getUTCDate())).toEqual([30]);
  });

  it("projects every weekly occurrence inside the window", () => {
    const dates = getRecurringOccurrences(
      {
        frequency: "WEEKLY",
        dayOfMonth: null,
        startDate: day("2026-07-30"),
        endDate: null,
        lastExecuted: null,
      },
      day("2026-07-30"),
      day("2026-08-29")
    );

    expect(dates).toHaveLength(5);
  });

  it("keeps monthly payments on the last valid day of shorter months", () => {
    const dates = getRecurringOccurrences(
      {
        frequency: "MONTHLY",
        dayOfMonth: 31,
        startDate: day("2026-01-31"),
        endDate: null,
        lastExecuted: day("2026-01-31"),
      },
      day("2026-02-01"),
      day("2026-03-31")
    );

    expect(dates.map((date) => `${date.getUTCMonth() + 1}-${date.getUTCDate()}`)).toEqual(["2-28", "3-31"]);
  });
});

describe("isRecurringDue", () => {
  // El caso reportado: alta el 31/7 de un ingreso que se cobra el 7. No se
  // puede ejecutar ese mismo día; recién corresponde el 7/8.
  const salaryOn7th = {
    frequency: "MONTHLY",
    dayOfMonth: 7,
    startDate: stored("2026-07-31"),
    endDate: null,
    lastExecuted: null,
  };

  it("no ejecuta un mensual el día del alta si el día elegido ya pasó", () => {
    expect(isRecurringDue(salaryOn7th, argToday("2026-07-31"))).toBe(false);
  });

  it("tampoco ejecuta en los días intermedios", () => {
    expect(isRecurringDue(salaryOn7th, argToday("2026-08-01"))).toBe(false);
    expect(isRecurringDue(salaryOn7th, argToday("2026-08-06"))).toBe(false);
  });

  it("ejecuta recién el día elegido", () => {
    expect(getNextDueDate(salaryOn7th)?.getUTCDate()).toBe(7);
    expect(isRecurringDue(salaryOn7th, argToday("2026-08-07"))).toBe(true);
  });

  it("si el cron se saltea días, ejecuta tarde pero no temprano", () => {
    expect(isRecurringDue(salaryOn7th, argToday("2026-08-09"))).toBe(true);
  });

  it("arranca el mismo mes si el día elegido todavía no pasó", () => {
    const due = getNextDueDate({
      ...salaryOn7th,
      startDate: stored("2026-07-02"),
      createdAt: stored("2026-07-02"),
    });
    expect(due && `${due.getUTCMonth() + 1}-${due.getUTCDate()}`).toBe("7-7");
  });

  // El caso exacto de producción: alta el 31/7 con inicio 7/7 (ya pasado) y
  // dayOfMonth en null, así que el día sale de startDate. No puede cobrarse por
  // el 7/7, que ocurrió antes de que el recurrente existiera.
  it("no ejecuta períodos anteriores al alta aunque el inicio esté en el pasado", () => {
    const backdated = {
      frequency: "MONTHLY",
      dayOfMonth: null,
      startDate: stored("2026-07-07"),
      endDate: null,
      lastExecuted: null,
      createdAt: stored("2026-07-31"),
    };
    expect(isRecurringDue(backdated, argToday("2026-07-31"))).toBe(false);
    expect(isRecurringDue(backdated, argToday("2026-08-06"))).toBe(false);
    expect(isRecurringDue(backdated, argToday("2026-08-07"))).toBe(true);
    const due = getNextDueDate(backdated);
    expect(due && `${due.getUTCMonth() + 1}-${due.getUTCDate()}`).toBe("8-7");
  });

  it("sin fecha de alta se comporta como antes (compatibilidad)", () => {
    const noCreatedAt = { ...salaryOn7th, startDate: stored("2026-08-07"), createdAt: null };
    expect(isRecurringDue(noCreatedAt, argToday("2026-08-07"))).toBe(true);
  });

  it("no repite dentro del mismo mes ya ejecutado", () => {
    const executed = { ...salaryOn7th, lastExecuted: stored("2026-08-07") };
    expect(isRecurringDue(executed, argToday("2026-08-20"))).toBe(false);
    expect(isRecurringDue(executed, argToday("2026-09-07"))).toBe(true);
  });

  it("respeta la fecha de fin", () => {
    const ended = { ...salaryOn7th, endDate: stored("2026-08-01") };
    expect(isRecurringDue(ended, argToday("2026-08-07"))).toBe(false);
  });

  it("un diario no se adelanta a su fecha de inicio", () => {
    const daily = {
      frequency: "DAILY",
      dayOfMonth: null,
      startDate: stored("2026-08-05"),
      endDate: null,
      lastExecuted: null,
    };
    expect(isRecurringDue(daily, argToday("2026-08-04"))).toBe(false);
    expect(isRecurringDue(daily, argToday("2026-08-05"))).toBe(true);
  });

  it("un semanal arranca en su fecha de inicio y espera 7 días", () => {
    const weekly = {
      frequency: "WEEKLY",
      dayOfMonth: null,
      startDate: stored("2026-08-05"),
      endDate: null,
      lastExecuted: stored("2026-08-05"),
    };
    expect(isRecurringDue(weekly, argToday("2026-08-11"))).toBe(false);
    expect(isRecurringDue(weekly, argToday("2026-08-12"))).toBe(true);
  });
});
