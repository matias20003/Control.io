import { describe, expect, it } from "vitest";
import {
  extractDeclaredCircleContact,
  matchDeclaredCircleContact,
} from "@/lib/whatsapp/circle-touch";

const contacts = [
  { id: "1", name: "Maria Cian" },
  { id: "2", name: "Juan Perez" },
  { id: "3", name: "Juan Gomez" },
  { id: "4", name: "@emi.yoris" },
];

describe("registro voluntario de Cercanos por WhatsApp", () => {
  it.each([
    ["Ya hablé con María Cian", "María Cian"],
    ["charle con @emi.yoris hoy", "@emi.yoris"],
    ["le escribí un mensaje a Juan Perez por WhatsApp", "Juan Perez"],
    ["mandé a Ana", "Ana"],
  ])("extrae una declaracion explicita: %s", (message, expected) => {
    expect(extractDeclaredCircleContact(message)).toBe(expected);
  });

  it("no infiere conversaciones de una mencion casual", () => {
    expect(extractDeclaredCircleContact("recordame hablar con Maria")).toBeNull();
    expect(extractDeclaredCircleContact("que hace Juan?")).toBeNull();
  });

  it("resuelve acentos, arrobas y nombres completos", () => {
    expect(matchDeclaredCircleContact("María Cian", contacts)).toEqual({
      kind: "matched",
      contact: contacts[0],
    });
    expect(matchDeclaredCircleContact("emi yoris", contacts)).toEqual({
      kind: "matched",
      contact: contacts[3],
    });
  });

  it("no adivina cuando un nombre corto coincide con dos personas", () => {
    expect(matchDeclaredCircleContact("Juan", contacts)).toEqual({
      kind: "ambiguous",
      contacts: [contacts[1], contacts[2]],
    });
  });

  it("explicita cuando la persona no esta en Cercanos", () => {
    expect(matchDeclaredCircleContact("Ana", contacts)).toEqual({
      kind: "not_found",
      declaredName: "Ana",
    });
  });
});
