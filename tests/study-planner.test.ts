import { describe, expect, it } from "vitest";
import {
  addDays, buildSchedule, capacityOf, daysBetween, feasibility, rebalance, type PlanConfig, type PlanItem,
} from "@/lib/study-planner";

/** Dos horas por día de lunes a viernes, una el sábado, nada el domingo. */
const SEMANA: PlanConfig = { minutesPerDay: [0, 120, 120, 120, 120, 120, 60], reviewDays: 0 };

const item = (id: string, minutes: number, extra: Partial<PlanItem> = {}): PlanItem => ({
  id, title: id, minutes, weight: 2, position: Number(id.replace(/\D/g, "")) || 0,
  done: false, isReview: false, ...extra,
});

const LUNES = "2026-08-03";
const EXAMEN = "2026-08-08"; // sábado

describe("calendario", () => {
  it("daysBetween incluye ambos extremos", () => {
    expect(daysBetween(LUNES, "2026-08-05")).toEqual(["2026-08-03", "2026-08-04", "2026-08-05"]);
  });

  it("un rango invertido no da dias", () => {
    expect(daysBetween("2026-08-05", LUNES)).toEqual([]);
  });

  it("capacityOf respeta el dia de la semana", () => {
    expect(capacityOf("2026-08-02", SEMANA)).toBe(0);   // domingo
    expect(capacityOf(LUNES, SEMANA)).toBe(120);        // lunes
  });
});

describe("buildSchedule", () => {
  it("no agenda nada el dia del examen: ese dia se rinde", () => {
    const schedule = buildSchedule([item("t1", 60)], LUNES, EXAMEN, SEMANA);
    expect(schedule.days.every((day) => day.day < EXAMEN)).toBe(true);
  });

  it("llena un dia hasta su capacidad y sigue en el siguiente", () => {
    const items = [item("t1", 120), item("t2", 60)];
    const schedule = buildSchedule(items, LUNES, EXAMEN, SEMANA);
    expect(schedule.days[0].day).toBe(LUNES);
    expect(schedule.days[0].minutes).toBe(120);
    expect(schedule.days[1].day).toBe("2026-08-04");
  });

  it("lo que mas pesa en el examen se ubica primero", () => {
    const items = [item("suelto", 60, { weight: 1, position: 0 }), item("clave", 60, { weight: 3, position: 9 })];
    const schedule = buildSchedule(items, LUNES, EXAMEN, SEMANA);
    expect(schedule.days[0].items[0].id).toBe("clave");
  });

  it("a igual peso respeta el orden del programa", () => {
    const items = [item("t2", 30), item("t1", 30)];
    const schedule = buildSchedule(items, LUNES, EXAMEN, SEMANA);
    expect(schedule.days[0].items.map((i) => i.id)).toEqual(["t1", "t2"]);
  });

  it("lo ya estudiado no se vuelve a agendar", () => {
    const items = [item("hecho", 120, { done: true }), item("falta", 60)];
    const schedule = buildSchedule(items, LUNES, EXAMEN, SEMANA);
    const agendados = schedule.days.flatMap((day) => day.items.map((i) => i.id));
    expect(agendados).toEqual(["falta"]);
  });

  it("dice lo que no entra en vez de esconderlo", () => {
    // Un solo dia util de 120 minutos contra 400 minutos de material.
    const corto: PlanConfig = { minutesPerDay: [0, 120, 0, 0, 0, 0, 0], reviewDays: 0 };
    const items = [item("t1", 120), item("t2", 140), item("t3", 140)];
    const schedule = buildSchedule(items, LUNES, "2026-08-04", corto);
    expect(schedule.overflow.length).toBeGreaterThan(0);
    expect(schedule.missingMinutes).toBeGreaterThan(0);
  });

  it("un tema mas largo que un dia entero igual recibe fecha", () => {
    const items = [item("mamotreto", 300)];
    const schedule = buildSchedule(items, LUNES, EXAMEN, SEMANA);
    expect(schedule.overflow).toHaveLength(0);
    expect(schedule.days[0].items[0].id).toBe("mamotreto");
  });

  it("los ultimos dias quedan para repasar", () => {
    const conRepaso: PlanConfig = { ...SEMANA, reviewDays: 2 };
    const items = [item("t1", 60), item("r1", 30, { isReview: true })];
    const schedule = buildSchedule(items, LUNES, EXAMEN, conRepaso);
    const repaso = schedule.items.find((i) => i.id === "r1")!;
    const nuevo = schedule.items.find((i) => i.id === "t1")!;
    // El repaso cae despues del material nuevo, en los dias reservados.
    expect(repaso.scheduledFor! > nuevo.scheduledFor!).toBe(true);
  });

  it("los dias sin tiempo disponible se saltean", () => {
    // Domingo 2026-08-02 tiene 0 minutos.
    const schedule = buildSchedule([item("t1", 60)], "2026-08-02", "2026-08-05", SEMANA);
    expect(schedule.days[0].day).toBe(LUNES);
  });
});

describe("rebalance", () => {
  it("reparte de nuevo desde hoy solo lo que falta", () => {
    const items = [
      item("t1", 120, { done: true }),
      item("t2", 120),
      item("t3", 120),
    ];
    // Arrancamos el miercoles: el lunes y el martes ya pasaron.
    const schedule = rebalance(items, "2026-08-05", EXAMEN, SEMANA);
    const dias = schedule.days.map((day) => day.day);
    expect(dias.every((day) => day >= "2026-08-05")).toBe(true);
    expect(schedule.days.flatMap((d) => d.items.map((i) => i.id))).toEqual(["t2", "t3"]);
  });

  it("atrasarse no borra lo hecho", () => {
    const items = [item("t1", 60, { done: true }), item("t2", 60)];
    const schedule = rebalance(items, "2026-08-06", EXAMEN, SEMANA);
    expect(schedule.items.find((i) => i.id === "t1")?.done).toBe(true);
  });
});

describe("feasibility", () => {
  it("avisa cuando el material no entra en el tiempo que queda", () => {
    const items = [item("t1", 600)];
    // Lunes y martes utiles (el examen es el miercoles): 240 minutos contra 600.
    const check = feasibility(items, LUNES, "2026-08-05", SEMANA);
    expect(check.fits).toBe(false);
    expect(check.neededMinutes).toBe(600);
    expect(check.availableMinutes).toBe(240);
    expect(check.minutesPerDayNeeded).toBe(300);
  });

  it("no cuenta los dias en que no estudias para decir cuanto falta por dia", () => {
    // Sabado y domingo, con el domingo en cero: los 120 minutos que faltan
    // tienen que caer todos en el sabado, no repartirse entre dos dias.
    const finde: PlanConfig = { minutesPerDay: [0, 0, 0, 0, 0, 0, 60], reviewDays: 0 };
    const check = feasibility([item("t1", 120)], "2026-08-08", "2026-08-10", finde);
    expect(check.minutesPerDayNeeded).toBe(120);
  });

  it("cuando entra, lo dice", () => {
    expect(feasibility([item("t1", 60)], LUNES, EXAMEN, SEMANA).fits).toBe(true);
  });

  it("lo ya estudiado no cuenta como trabajo pendiente", () => {
    const check = feasibility([item("t1", 600, { done: true })], LUNES, "2026-08-05", SEMANA);
    expect(check.neededMinutes).toBe(0);
    expect(check.fits).toBe(true);
  });
});

describe("addDays", () => {
  it("cruza el fin de mes sin romperse", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
  });
});
