/**
 * Mi Círculo · El Norte — de quién querés ser a qué información entra.
 *
 * Los temas sueltos son fríos y no deciden nada. Acá el usuario declara dos o
 * tres frentes ("tener obra propia", "salud", "salir de deudas") y de ahí se
 * derivan los términos con los que se filtra todo lo demás. El primer frente
 * pesa más: sus temas son los prioritarios.
 *
 * Puro y determinista: sin red, sin IA, sin reloj.
 */

export type NorthFront = {
  id: string;
  label: string;
  detail: string | null;
  topics: string[];
  position: number;
};

/** Cuántos frentes tiene sentido sostener a la vez. Más es no tener ninguno. */
export const MAX_FRONTS = 3;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas de acento, ya separadas por NFD
    .toLowerCase()
    .trim();
}

/**
 * Intención de búsqueda construida con todo lo que escribió la persona.
 * Conservamos la frase completa porque sus relaciones importan: "IA para
 * arquitectura" no significa lo mismo que buscar "IA" y "arquitectura" por
 * separado.
 */
export function suggestTopics(label: string, detail?: string | null): string[] {
  const cleanLabel = label.replace(/\s+/g, " ").trim();
  const cleanDetail = (detail ?? "").replace(/\s+/g, " ").trim();
  if (!cleanLabel) return [];

  const intention = cleanDetail
    ? `${cleanLabel}. ${cleanDetail}`
    : cleanLabel;
  return [intention.slice(0, 160)];
}

export type DerivedTopics = {
  /** Todos los términos, sin repetir. */
  topics: string[];
  /** Los del frente principal: pesan primero al armar la edición. */
  priorityTopics: string[];
};

/**
 * Los temas con los que se va a buscar, derivados de los frentes. Si no hay
 * frentes declarados devuelve vacío — y el llamador decide si cae a la config
 * vieja. Nunca inventa un tema.
 */
export function deriveTopics(fronts: NorthFront[]): DerivedTopics {
  const ordenados = [...fronts].sort((a, b) => a.position - b.position);
  const vistos = new Set<string>();
  const topics: string[] = [];

  for (const front of ordenados) {
    const semanticTopics = suggestTopics(front.label, front.detail);
    for (const topic of semanticTopics) {
      const clave = normalize(topic);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      topics.push(topic);
    }
  }

  const principal = ordenados[0];
  const priorityTopics = principal ? suggestTopics(principal.label, principal.detail) : [];

  return { topics, priorityTopics };
}

/**
 * A qué frente sirve una pieza, mirando su tema. Devuelve null cuando no hay
 * relación: una pieza sin razón declarada es preferible a una razón inventada.
 */
export function frontForTopic(
  topic: string | null | undefined,
  fronts: NorthFront[],
): NorthFront | null {
  if (!topic) return null;
  const objetivo = normalize(topic);
  if (!objetivo) return null;

  for (const front of fronts) {
    for (const candidato of front.topics) {
      const clave = normalize(candidato);
      if (!clave) continue;
      if (objetivo === clave || objetivo.includes(clave) || clave.includes(objetivo)) {
        return front;
      }
    }
  }
  return null;
}

/** El texto que explica por qué una pieza está en la edición de hoy. */
export function inclusionReasonForFront(front: NorthFront | null): string | null {
  return front ? `Está acá por tu frente: ${front.label}.` : null;
}

/** ¿Hace cuánto que no revisa su Norte? Se revisa cada tres meses. */
export function northNeedsReview(
  reviewedAt: Date | null,
  createdAt: Date,
  today: Date,
): boolean {
  const referencia = reviewedAt ?? createdAt;
  const dias = (today.getTime() - referencia.getTime()) / 86_400_000;
  return dias >= 90;
}
