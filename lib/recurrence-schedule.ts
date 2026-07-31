import { addDays, startOfDay } from "date-fns";

export type RecurrenceScheduleInput = {
  frequency: string;
  dayOfMonth: number | null;
  startDate: Date;
  endDate: Date | null;
  lastExecuted: Date | null;
};

function calendarDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

function nextOccurrence(date: Date, frequency: string, targetDay: number): Date | null {
  if (frequency === "DAILY") return addDays(date, 1);
  if (frequency === "WEEKLY") return addDays(date, 7);
  if (frequency === "BIWEEKLY") return addDays(date, 14);
  if (frequency === "MONTHLY") return calendarDate(date.getFullYear(), date.getMonth() + 1, targetDay);
  if (frequency === "QUARTERLY") return calendarDate(date.getFullYear(), date.getMonth() + 3, targetDay);
  if (frequency === "YEARLY") return calendarDate(date.getFullYear() + 1, date.getMonth(), targetDay);
  return null;
}

export function getRecurringOccurrences(
  recurring: RecurrenceScheduleInput,
  from: Date,
  to: Date
): Date[] {
  const lower = startOfDay(from);
  const upper = startOfDay(to);
  const start = startOfDay(recurring.startDate);
  const end = recurring.endDate ? startOfDay(recurring.endDate) : null;
  const targetDay = recurring.dayOfMonth ?? start.getDate();

  let cursor = recurring.lastExecuted
    ? nextOccurrence(startOfDay(recurring.lastExecuted), recurring.frequency, targetDay)
    : start;
  if (!cursor) return [];

  let guard = 0;
  while (cursor < lower && guard < 5000) {
    const next = nextOccurrence(cursor, recurring.frequency, targetDay);
    if (!next) return [];
    cursor = next;
    guard++;
  }

  const occurrences: Date[] = [];
  while (cursor <= upper && (!end || cursor <= end) && occurrences.length < 366) {
    occurrences.push(cursor);
    const next = nextOccurrence(cursor, recurring.frequency, targetDay);
    if (!next) break;
    cursor = next;
  }
  return occurrences;
}
