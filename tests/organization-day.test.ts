import { describe, expect, it } from "vitest";
import { hasTime, inboxOf, planForDay, scheduledOn, type DayTask } from "@/lib/organization-day";

/** Fecha argentina como la guarda la app (ISO con offset -03:00). */
const arg = (day: string, time = "12:00") => new Date(`${day}T${time}:00-03:00`).toISOString();

function task(overrides: Partial<DayTask> & { id: string }): DayTask {
  return {
    dueDate: null,
    scheduledStart: null,
    scheduledEnd: null,
    someday: false,
    done: false,
    priority: "NONE",
    urgent: false,
    important: false,
    order: 0,
    ...overrides,
  };
}

const HOY = "2026-08-05";

describe("hasTime", () => {
  it("hay hora solo si hay bloque completo", () => {
    expect(hasTime({ scheduledStart: arg(HOY, "09:00"), scheduledEnd: arg(HOY, "10:00") })).toBe(true);
    expect(hasTime({ scheduledStart: arg(HOY, "00:00"), scheduledEnd: null })).toBe(false);
    expect(hasTime({ scheduledStart: null, scheduledEnd: null })).toBe(false);
  });
});

describe("planForDay", () => {
  it("lo agendado para otro dia no aparece hoy", () => {
    const jueves = task({ id: "a", scheduledStart: arg("2026-08-06", "10:00"), scheduledEnd: arg("2026-08-06", "11:00") });
    const plan = planForDay([jueves], HOY, HOY);
    expect(plan.total).toBe(0);
  });

  it("ordena lo que tiene hora cronologicamente", () => {
    const tarde = task({ id: "tarde", scheduledStart: arg(HOY, "15:00"), scheduledEnd: arg(HOY, "16:00") });
    const temprano = task({ id: "temprano", scheduledStart: arg(HOY, "09:00"), scheduledEnd: arg(HOY, "10:00") });
    const plan = planForDay([tarde, temprano], HOY, HOY);
    expect(plan.timed.map((t) => t.id)).toEqual(["temprano", "tarde"]);
  });

  it("separa lo reservado sin hora y lo ordena por prioridad", () => {
    const baja = task({ id: "baja", scheduledStart: arg(HOY, "00:00"), priority: "LOW" });
    const alta = task({ id: "alta", scheduledStart: arg(HOY, "00:00"), priority: "HIGH" });
    const plan = planForDay([baja, alta], HOY, HOY);
    expect(plan.timed).toHaveLength(0);
    expect(plan.untimed.map((t) => t.id)).toEqual(["alta", "baja"]);
  });

  it("lo que vence hoy aparece aunque no lo hayas agendado", () => {
    const vence = task({ id: "vence", dueDate: arg(HOY) });
    const plan = planForDay([vence], HOY, HOY);
    expect(plan.due.map((t) => t.id)).toEqual(["vence"]);
  });

  it("lo atrasado nunca se esconde", () => {
    const ayer = task({ id: "ayer", scheduledStart: arg("2026-08-04", "00:00") });
    const vencido = task({ id: "vencido", dueDate: arg("2026-08-01") });
    const plan = planForDay([ayer, vencido], HOY, HOY);
    expect(plan.overdue.map((t) => t.id).sort()).toEqual(["ayer", "vencido"]);
  });

  it("no marca atrasado si estas mirando otro dia", () => {
    const ayer = task({ id: "ayer", scheduledStart: arg("2026-08-04", "00:00") });
    const plan = planForDay([ayer], "2026-08-10", HOY);
    expect(plan.overdue).toHaveLength(0);
    expect(plan.total).toBe(0);
  });

  it("una tarea no se cuenta dos veces si esta agendada y vence el mismo dia", () => {
    const ambas = task({
      id: "ambas",
      scheduledStart: arg(HOY, "09:00"),
      scheduledEnd: arg(HOY, "10:00"),
      dueDate: arg(HOY),
    });
    const plan = planForDay([ambas], HOY, HOY);
    expect(plan.total).toBe(1);
    expect(plan.timed.map((t) => t.id)).toEqual(["ambas"]);
    expect(plan.due).toHaveLength(0);
  });

  it("Algun dia y lo hecho quedan fuera del plan", () => {
    const algunDia = task({ id: "algun", scheduledStart: arg(HOY, "00:00"), someday: true });
    const hecha = task({ id: "hecha", scheduledStart: arg(HOY, "00:00"), done: true });
    const plan = planForDay([algunDia, hecha], HOY, HOY);
    expect(plan.total).toBe(0);
  });
});

describe("scheduledOn", () => {
  it("la semana muestra lo agendado a futuro: nada desaparece, cambia de lugar", () => {
    const jueves = task({ id: "jueves", scheduledStart: arg("2026-08-06", "10:00"), scheduledEnd: arg("2026-08-06", "11:00") });
    expect(planForDay([jueves], HOY, HOY).total).toBe(0);
    expect(scheduledOn([jueves], "2026-08-06").map((t) => t.id)).toEqual(["jueves"]);
  });

  it("pone primero lo que tiene hora", () => {
    const sinHora = task({ id: "sin", scheduledStart: arg(HOY, "00:00"), priority: "HIGH" });
    const conHora = task({ id: "con", scheduledStart: arg(HOY, "15:00"), scheduledEnd: arg(HOY, "16:00") });
    expect(scheduledOn([sinHora, conHora], HOY).map((t) => t.id)).toEqual(["con", "sin"]);
  });
});

describe("inboxOf", () => {
  it("solo lo que no tiene dia ni esta en Algun dia", () => {
    const suelta = task({ id: "suelta" });
    const algunDia = task({ id: "algun", someday: true });
    const agendada = task({ id: "agendada", scheduledStart: arg(HOY, "00:00") });
    const vence = task({ id: "vence", dueDate: arg(HOY) });
    expect(inboxOf([suelta, algunDia, agendada, vence]).map((t) => t.id)).toEqual(["suelta"]);
  });
});
