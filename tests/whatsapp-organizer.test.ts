import { describe, expect, it } from "vitest";
import { findFirstFreeSlot, formatOrganizerReply, parseOrganizerQuery } from "@/lib/whatsapp/organizer";

const now = new Date("2026-07-30T15:00:00.000Z");
const event = {
  id: "1", summary: "Dentista", start: "2026-07-31T15:00:00-03:00",
  end: "2026-07-31T16:00:00-03:00", allDay: false, location: "Centro",
  description: null, busy: true,
};

describe("organizador de Google Calendar", () => {
  it("interpreta disponibilidad para mañana con horario", () => {
    const query = parseOrganizerQuery("¿Estoy libre mañana de 15 a 17?", now);
    expect(query?.kind).toBe("availability");
    expect(query?.hasSpecificTime).toBe(true);
  });

  it("informa conflictos usando eventos reales", () => {
    const query = parseOrganizerQuery("¿Estoy libre mañana de 15 a 17?", now)!;
    const reply = formatOrganizerReply(query, [event]);
    expect(reply).toContain("No estás libre");
    expect(reply).toContain("Dentista");
  });

  it("lista la agenda real del día", () => {
    const query = parseOrganizerQuery("¿Qué tengo mañana?", now)!;
    expect(formatOrganizerReply(query, [event])).toContain("Dentista");
  });

  it("encuentra un bloque libre respetando eventos y margen", () => {
    const slot = findFirstFreeSlot(
      [event],
      new Date("2026-07-31T11:00:00-03:00"),
      new Date("2026-07-31T20:00:00-03:00"),
      50,
      { workStart: 8, workEnd: 20, bufferMinutes: 10 }
    );
    expect(slot?.start.toISOString()).toBe("2026-07-31T14:00:00.000Z");
  });
});
