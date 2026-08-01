/**
 * Reconoce una declaracion voluntaria de contacto para Mi Circulo.
 *
 * Control.io no inspecciona conversaciones: este parser solo actua cuando el
 * usuario dice explicitamente que hablo o escribio con alguien.
 */

type CircleContactRef = { id: string; name: string };

export type CircleTouchMatch =
  | { kind: "matched"; contact: CircleContactRef }
  | { kind: "ambiguous"; contacts: CircleContactRef[] }
  | { kind: "not_found"; declaredName: string };

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Devuelve el nombre solo ante una declaracion explicita, nunca por contexto. */
export function extractDeclaredCircleContact(message: string): string | null {
  const clean = message.trim();
  const patterns = [
    /^(?:ya\s+)?(?:hable|habl[eé]|charle|charl[eé]|converse|convers[eé]|me\s+comunique|me\s+comuniqu[eé]|estuve\s+hablando)\s+con\s+(.+)$/i,
    /^(?:ya\s+)?(?:le\s+)?(?:escribi|escrib[ií]|mande|mand[eé])(?:\s+un\s+mensaje)?\s+a\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (!match?.[1]) continue;
    const name = match[1]
      .replace(/\s+(?:hoy|ayer|recien|reci[eé]n)$/i, "")
      .replace(/\s+(?:por|en)\s+(?:whatsapp|instagram|telefono|tel[eé]fono)$/i, "")
      .replace(/[.!?]+$/g, "")
      .trim();
    return name || null;
  }

  return null;
}

export function matchDeclaredCircleContact(
  declaredName: string,
  contacts: CircleContactRef[],
): CircleTouchMatch {
  const target = normalize(declaredName);
  const exact = contacts.filter((contact) => normalize(contact.name) === target);
  if (exact.length === 1) return { kind: "matched", contact: exact[0] };
  if (exact.length > 1) return { kind: "ambiguous", contacts: exact };

  // Permite "Juan" para "Juan Perez", pero nunca elige si hay dos Juanes.
  const partial = contacts.filter((contact) => {
    const name = normalize(contact.name);
    return name.startsWith(`${target} `) || target.startsWith(`${name} `);
  });
  if (partial.length === 1) return { kind: "matched", contact: partial[0] };
  if (partial.length > 1) return { kind: "ambiguous", contacts: partial };

  return { kind: "not_found", declaredName };
}
