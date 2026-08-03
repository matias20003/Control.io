/**
 * Mi Círculo · el espejo.
 *
 * La otra mitad de la recompensa. La maquinaria fabricada te trae hoy; esto es
 * lo que te demuestra la semana que viene que valió la pena venir. Sola, la
 * maquinaria es un casino: el hit se siente y no queda nada. Solo, el espejo es
 * una planilla verdadera que nadie abre. Van juntos.
 *
 * Regla dura: acá no se fabrica nada. Cada línea es un hecho declarado por la
 * persona o derivado de algo que hizo. Si no hay con qué, no hay línea — y si
 * no hay nada, el espejo dice que todavía no.
 *
 * Puro y determinista.
 */

export type MirrorInput = {
  /** El día 1: a cuántas cuentas seguía. Null si nunca se miró al espejo. */
  followedAtStart: number | null;
  /** Hoy. */
  sourcesNow: number;
  peopleNow: number;
  /** Conversaciones declaradas, de siempre. */
  conversations: number;
  /** Conversaciones que además dejaron escrito qué salió. */
  conversationsWithMemory: number;
  /** Lecturas convertidas que siguen vivas. */
  habitsAlive: number;
  tasksDone: number;
  /** Total convertido alguna vez. */
  converted: number;
  daysWithoutInstagram: number | null;
};

export type MirrorLine = {
  key: string;
  label: string;
  /** Cómo era antes. Null cuando no hay línea de base con qué comparar. */
  before: string | null;
  after: string;
  detail: string | null;
};

export type Mirror = {
  /** La frase que resume el cambio. Null si todavía no hay cambio que contar. */
  headline: string | null;
  lines: MirrorLine[];
  /** Hay material real para mostrar. */
  isReady: boolean;
  /** Qué le falta para que el espejo tenga algo que decir. */
  missing: string | null;
};

function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

/**
 * El espejo. El orden importa: primero lo que se achicó (la métrica invertida),
 * después la gente, y al final lo que sobrevivió — que es la prueba más difícil
 * de conseguir y la que de verdad significa que algo cambió.
 */
export function buildMirror(input: MirrorInput): Mirror {
  const lines: MirrorLine[] = [];

  // 1 · Lo que se achicó. Mientras todos los algoritmos expanden tu feed, este
  // lo achica: por eso este número va primero y por eso que baje es el logro.
  if (input.followedAtStart !== null && input.followedAtStart > 0) {
    lines.push({
      key: "fuentes",
      label: "De dónde sale lo que leés",
      before: plural(input.followedAtStart, "cuenta", "cuentas"),
      after: plural(input.sourcesNow, "fuente", "fuentes"),
      detail:
        input.sourcesNow < input.followedAtStart
          ? `${input.followedAtStart - input.sourcesNow} menos que cuando empezaste.`
          : null,
    });
  } else if (input.sourcesNow > 0) {
    lines.push({
      key: "fuentes",
      label: "De dónde sale lo que leés",
      before: null,
      after: plural(input.sourcesNow, "fuente", "fuentes"),
      detail: "Todas elegidas por vos.",
    });
  }

  // 2 · La gente. No cuántos contactos tenés: cuántas veces hablaron de verdad.
  if (input.conversations > 0) {
    lines.push({
      key: "conversaciones",
      label: "Conversaciones que ocurrieron",
      before: null,
      after: plural(input.conversations, "conversación", "conversaciones"),
      detail:
        input.conversationsWithMemory > 0
          ? `${input.conversationsWithMemory} dejaron algo escrito.`
          : `Con ${plural(input.peopleNow, "persona", "personas")} de tu círculo.`,
    });
  }

  // 3 · Lo que sobrevivió. La prueba más cara de conseguir: no cuánto
  // convertiste, sino cuánto de eso sigue en pie.
  const alive = input.habitsAlive + input.tasksDone;
  if (alive > 0) {
    const partes = [
      input.habitsAlive > 0
        ? plural(input.habitsAlive, "hábito que seguís", "hábitos que seguís")
        : null,
      input.tasksDone > 0
        ? plural(input.tasksDone, "cosa que hiciste", "cosas que hiciste")
        : null,
    ].filter(Boolean);
    lines.push({
      key: "vivo",
      label: "Lo que leíste y sigue vivo",
      before: null,
      after: partes.join(" y "),
      detail:
        input.converted > alive
          ? `De ${plural(input.converted, "cosa convertida", "cosas convertidas")}.`
          : null,
    });
  }

  if (input.daysWithoutInstagram !== null && input.daysWithoutInstagram > 0) {
    lines.push({
      key: "sin-instagram",
      label: "Sin Instagram",
      before: null,
      after: plural(input.daysWithoutInstagram, "día", "días"),
      detail: null,
    });
  }

  const isReady = input.conversations > 0 || alive > 0;

  return {
    headline: isReady ? headline(input, alive) : null,
    lines,
    isReady,
    missing: isReady
      ? null
      : "Todavía no. Hablá con alguien de tu círculo o convertí una lectura en algo: el espejo se llena con lo que hacés, no con lo que leés.",
  };
}

function headline(input: MirrorInput, alive: number): string {
  if (input.followedAtStart !== null && input.sourcesNow < input.followedAtStart) {
    return `Pasaste de ${input.followedAtStart} cuentas a ${plural(
      input.sourcesNow,
      "fuente",
      "fuentes",
    )}, y ${plural(input.conversations, "conversación pasó", "conversaciones pasaron")} de verdad.`;
  }
  if (alive > 0 && input.conversations > 0) {
    return `${plural(input.conversations, "conversación", "conversaciones")} y ${plural(
      alive,
      "cosa que sigue en pie",
      "cosas que siguen en pie",
    )}.`;
  }
  if (input.conversations > 0) {
    return `${plural(
      input.conversations,
      "conversación que no hubiera pasado",
      "conversaciones que no hubieran pasado",
    )}.`;
  }
  return `${plural(alive, "cosa que leíste sigue viva", "cosas que leíste siguen vivas")}.`;
}
