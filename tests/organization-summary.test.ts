import { describe, expect, it } from "vitest";
import {
  countToday, loadOfWeek, summarizeHabits, summarizeOrganization, weekDaysOf, type HabitLike,
} from "@/lib/organization-summary";
import type { DayTask } from "@/lib/organization-day";

const arg = (day: string, time = "12:00") => new Date(`${day}T${time}:00-03:00`).toISOString();
const HOY = "2026-08-05"; // miércoles

function task(overrides: Partial<DayTask> & { id: string }): DayTask {
  return {
    dueDate: null, scheduledStart: null, scheduledEnd: null, someday: false,
    done: false, priority: "NONE", urgent: false, important: false, order: 0,
    ...overrides,
  };
}

function habit(overrides: Partial<HabitLike> & { id: string }): HabitLike {
  return {
    name: overrides.id, icon: null, anchor: null, frequency: "DAILY", daysOfWeek: [],
    completions: [], ...overrides,
  };
}

describe("weekDaysOf", () => {
  it("arranca el lunes y da siete dias", () => {
    const week = weekDaysOf(HOY);
    expect(week).toHaveLength(7);
    expect(week[0]).toBe("2026-08-03"); // lunes
    expect(week[6]).toBe("2026-08-09"); // domingo
    expect(week).toContain(HOY);
  });

  it("un domingo pertenece a la semana que arranco el lunes anterior", () => {
    expect(weekDaysOf("2026-08-09")[0]).toBe("2026-08-03");
  });
});

describe("countToday", () => {
  it("cuenta lo que rodo dentro del dia, no aparte", () => {
    const deAyer = task({ id: "ayer", scheduledStart: arg("2026-08-04", "00:00") });
    const deHoy = task({ id: "hoy", scheduledStart: arg(HOY, "00:00") });
    const count = countToday([deAyer, deHoy], HOY);
    expect(count.total).toBe(2);
    expect(count.untimed).toBe(2);
    expect(count.rolled).toBe(1);
  });
});

describe("summarizeHabits", () => {
  it("separa los que tocan hoy de los que no", () => {
    const lunes = habit({ id: "lunes", frequency: "WEEKLY", daysOfWeek: [1] });
    const diario = habit({ id: "diario" });
    const resumen = summarizeHabits([lunes, diario], HOY); // miércoles
    expect(resumen.due).toBe(1);
    expect(resumen.pendingHabits.map((h) => h.id)).toEqual(["diario"]);
  });

  it("cuenta los cumplidos de hoy", () => {
    const hecho = habit({ id: "hecho", completions: [{ date: HOY }] });
    const falta = habit({ id: "falta" });
    const resumen = summarizeHabits([hecho, falta], HOY);
    expect(resumen.done).toBe(1);
    expect(resumen.pending).toBe(1);
  });

  it("ofrece primero el mas flojo, que es el que necesita el empujon", () => {
    const dias = (n: number) => Array.from({ length: n }, (_, i) =>
      new Date(Date.parse(`${HOY}T00:00:00.000Z`) - (i + 1) * 86_400_000).toISOString().slice(0, 10),
    ).map((date) => ({ date }));
    const firme = habit({ id: "firme", completions: dias(60) });
    const flojo = habit({ id: "flojo", completions: dias(2) });
    const resumen = summarizeHabits([firme, flojo], HOY);
    expect(resumen.pendingHabits.map((h) => h.id)).toEqual(["flojo", "firme"]);
  });
});

describe("loadOfWeek", () => {
  it("reparte la carga por dia y marca el mas cargado", () => {
    const week = loadOfWeek(
      [
        task({ id: "a", scheduledStart: arg("2026-08-06", "00:00") }),
        task({ id: "b", scheduledStart: arg("2026-08-06", "00:00") }),
        task({ id: "c", scheduledStart: arg(HOY, "00:00") }),
      ],
      HOY,
    );
    expect(week.total).toBe(3);
    expect(week.busiest).toBe("2026-08-06");
    expect(week.days.find((d) => d.isToday)?.day).toBe(HOY);
  });

  it("una semana vacia no tiene dia mas cargado", () => {
    expect(loadOfWeek([], HOY).busiest).toBeNull();
  });
});

describe("summarizeOrganization", () => {
  it("lo descartado no cuenta en ningun lado", () => {
    const viva = task({ id: "viva" });
    const muerta = task({ id: "muerta", status: "DROPPED" });
    const resumen = summarizeOrganization([viva, muerta], [], HOY);
    expect(resumen.inbox).toBe(1);
  });

  it("cuenta lo terminado hoy y lo guardado para algun dia", () => {
    const hecha = task({ id: "hecha", done: true, scheduledStart: arg(HOY, "09:00") });
    const algunDia = task({ id: "luego", someday: true });
    const resumen = summarizeOrganization([hecha, algunDia], [], HOY);
    expect(resumen.doneToday).toBe(1);
    expect(resumen.someday).toBe(1);
    expect(resumen.today.total).toBe(0);
  });
});
