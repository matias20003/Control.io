import { describe, expect, it } from "vitest";
import { getRecurringOccurrences } from "@/lib/recurrence-schedule";

const day = (iso: string) => new Date(`${iso}T12:00:00-03:00`);

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

    expect(dates.map((date) => date.getDate())).toEqual([30]);
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

    expect(dates.map((date) => `${date.getMonth() + 1}-${date.getDate()}`)).toEqual(["2-28", "3-31"]);
  });
});
