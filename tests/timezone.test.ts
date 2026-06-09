import { describe, expect, it } from "vitest";
import {
  startOfTodayArg,
  endOfTodayArg,
  todayStringArg,
  nowArgParts,
} from "@/lib/timezone";

describe("timezone Argentina (UTC-3)", () => {
  it("startOfTodayArg < endOfTodayArg y abarca ~24h", () => {
    const s = startOfTodayArg().getTime();
    const e = endOfTodayArg().getTime();
    expect(s).toBeLessThan(e);
    const hours = (e - s) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);
  });

  it("el instante actual cae dentro de [inicio, fin] del día", () => {
    const now = Date.now();
    expect(startOfTodayArg().getTime()).toBeLessThanOrEqual(now);
    expect(endOfTodayArg().getTime()).toBeGreaterThanOrEqual(now);
  });

  it("medianoche ARG = 03:00 UTC (clave para que los crons no se corran de día)", () => {
    const d = startOfTodayArg();
    expect(d.getUTCHours()).toBe(3);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });

  it("todayStringArg tiene formato YYYY-MM-DD", () => {
    expect(todayStringArg()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("nowArgParts devuelve weekday 0-6 y hour 0-23", () => {
    const { weekday, hour } = nowArgParts();
    expect(weekday).toBeGreaterThanOrEqual(0);
    expect(weekday).toBeLessThanOrEqual(6);
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
  });
});
