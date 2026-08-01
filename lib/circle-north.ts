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

// Palabras que no distinguen nada como término de búsqueda.
const VACIAS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al",
  "a", "ante", "con", "contra", "en", "entre", "hacia", "hasta", "para", "por",
  "sin", "sobre", "tras", "y", "e", "o", "u", "que", "qué", "mi", "mis", "tu",
  "tus", "su", "sus", "me", "te", "se", "lo", "es", "ser", "estar", "tener",
  "quiero", "querer", "poder", "más", "mas", "muy", "como", "propio", "propia",
]);

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas de acento, ya separadas por NFD
    .toLowerCase()
    .trim();
}

/**
 * Términos de búsqueda sugeridos a partir de cómo la persona describió su
 * frente. Es un punto de partida editable, no una verdad: el usuario manda.
 */
export function suggestTopics(label: string, detail?: string | null): string[] {
  const texto = `${label} ${detail ?? ""}`;
  const palabras = texto
    .split(/[\s,.;:!?()"'—–-]+/)
    .map((palabra) => palabra.trim())
    .filter(Boolean)
    .filter((palabra) => palabra.length >= 4)
    .filter((palabra) => !VACIAS.has(normalize(palabra)));

  const vistas = new Set<string>();
  const terminos: string[] = [];
  for (const palabra of palabras) {
    const clave = normalize(palabra);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    terminos.push(palabra.toLowerCase());
    if (terminos.length === 4) break;
  }
  return terminos;
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
    for (const topic of front.topics) {
      const clave = normalize(topic);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      topics.push(topic);
    }
  }

  const principal = ordenados[0];
  const priorityTopics = principal
    ? principal.topics.filter((topic) => topic.trim().length > 0)
    : [];

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
