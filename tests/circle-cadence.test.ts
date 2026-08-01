import { describe, expect, it } from "vitest";
import {
  cadenceBudget,
  cadenceState,
  selectDailyContacts,
  sinceLabel,
  tierForCadence,
} from "@/lib/circle-cadence";

// Mediodía ARG, para que ninguna aserción dependa del corte de medianoche.
function arg(day: string): Date {
  return new Date(`${day}T15:00:00.000Z`);
}

const HOY = arg("2026-08-01");

function contact(over: Partial<Parameters<typeof cadenceState>[0]> = {}) {
  return {
    cadenceDays: 28,
    lastContactAt: arg("2026-07-01"),
    createdAt: arg("2026-01-01"),
    ...over,
  };
}

describe("cadenceState", () => {
  it("cuenta los días desde la última conversación", () => {
    const state = cadenceState(contact({ lastContactAt: arg("2026-07-25") }), HOY);
    expect(state.daysSince).toBe(7);
    expect(state.neverContacted).toBe(false);
  });

  it("no pide nada si la cadencia todavía no se cumplió", () => {
    const state = cadenceState(
      contact({ cadenceDays: 28, lastContactAt: arg("2026-07-25") }),
      HOY,
    );
    expect(state.overdueDays).toBe(-21);
    expect(state.isDue).toBe(false);
  });

  it("toca justo el día que se cumple la cadencia", () => {
    const state = cadenceState(
      contact({ cadenceDays: 7, lastContactAt: arg("2026-07-25") }),
      HOY,
    );
    expect(state.overdueDays).toBe(0);
    expect(state.isDue).toBe(true);
  });

  it("sin conversación declarada, la persona sale a la superficie enseguida", () => {
    const state = cadenceState(
      contact({ cadenceDays: 180, lastContactAt: null, createdAt: arg("2026-07-30") }),
      HOY,
    );
    expect(state.neverContacted).toBe(true);
    expect(state.isDue).toBe(true);
  });

  it("marcar 'hablamos hoy' al dar de alta evita el aviso desde el día 1", () => {
    const state = cadenceState(
      contact({ cadenceDays: 28, lastContactAt: HOY, createdAt: HOY }),
      HOY,
    );
    expect(state.isDue).toBe(false);
  });
});

describe("selectDailyContacts", () => {
  it("nunca pone más de dos personas adelante", () => {
    const contacts = ["a", "b", "c", "d"].map((id) => ({
      id,
      ...contact({ cadenceDays: 7, lastContactAt: arg("2026-01-01") }),
    }));
    expect(selectDailyContacts(contacts, HOY)).toHaveLength(2);
  });

  it("prioriza a la persona más atrasada", () => {
    const contacts = [
      { id: "reciente", ...contact({ cadenceDays: 7, lastContactAt: arg("2026-07-20") }) },
      { id: "olvidada", ...contact({ cadenceDays: 7, lastContactAt: arg("2026-02-01") }) },
    ];
    expect(selectDailyContacts(contacts, HOY)[0].id).toBe("olvidada");
  });

  it("devuelve vacío cuando no toca nadie — es una respuesta válida", () => {
    const contacts = [{ id: "a", ...contact({ cadenceDays: 90, lastContactAt: arg("2026-07-30") }) }];
    expect(selectDailyContacts(contacts, HOY)).toEqual([]);
  });

  it("empata de forma estable, así la sugerencia no baila durante el día", () => {
    const contacts = [
      { id: "zoe", ...contact({ cadenceDays: 7, lastContactAt: arg("2026-07-01") }) },
      { id: "ana", ...contact({ cadenceDays: 7, lastContactAt: arg("2026-07-01") }) },
    ];
    expect(selectDailyContacts(contacts, HOY).map((c) => c.id)).toEqual(["ana", "zoe"]);
  });
});

describe("cadenceBudget", () => {
  it("50 personas con cadencia de 8 semanas piden menos de una charla por día", () => {
    const budget = cadenceBudget(Array.from({ length: 50 }, () => ({ cadenceDays: 56 })));
    expect(budget.perDay).toBeLessThan(1);
    expect(budget.isOverloaded).toBe(false);
  });

  it("avisa cuando las cadencias piden más de lo sostenible", () => {
    const budget = cadenceBudget(Array.from({ length: 20 }, () => ({ cadenceDays: 7 })));
    expect(budget.isOverloaded).toBe(true);
  });

  it("una lista vacía no pide nada", () => {
    expect(cadenceBudget([])).toMatchObject({ perDay: 0, isOverloaded: false });
  });
});

describe("etiquetas", () => {
  it("agrupa por frecuencia", () => {
    expect(tierForCadence(7)).toBe("INTIMATE");
    expect(tierForCadence(28)).toBe("CLOSE");
    expect(tierForCadence(180)).toBe("ORBIT");
  });

  it("dice el tiempo como lo diría una persona", () => {
    expect(sinceLabel(0, false)).toBe("hoy");
    expect(sinceLabel(1, false)).toBe("ayer");
    expect(sinceLabel(21, false)).toBe("hace 3 semanas");
    expect(sinceLabel(60, false)).toBe("hace 2 meses");
    expect(sinceLabel(400, false)).toBe("hace 1 año");
    expect(sinceLabel(400, true)).toBe("sin registro");
  });
});
