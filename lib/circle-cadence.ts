/**
 * Mi Círculo · Cercanos — aritmética de cadencia.
 *
 * La decisión de producto que gobierna este archivo: el límite NO está en
 * cuánta gente entra a tu círculo, sino en cuánta te aparece por día. Podés
 * tener 50 personas; si cada una tiene su frecuencia, la superficie diaria
 * sigue siendo de una o dos conversaciones. Ver docs/MI_CIRCULO.md.
 *
 * Todo acá es determinista: se le pasa el "hoy" en vez de leer el reloj, así
 * la selección del día no cambia entre el server y el cliente.
 */

import { startOfDayArg } from "./timezone";

const DAY_MS = 86_400_000;

/** Cuántas personas como máximo puede pedirte la app en un día. */
export const DAILY_SURFACE_LIMIT = 2;

/**
 * Umbral de sobrecarga: si las cadencias cargadas esperan más de esto por día,
 * la lista se volvió una lista de deudas sociales y hay que avisar.
 */
export const OVERLOAD_PER_DAY = 2;

export type CircleTier = "INTIMATE" | "CLOSE" | "ORBIT";

export const CADENCE_PRESETS: { days: number; label: string; tier: CircleTier }[] = [
  { days: 7, label: "Cada semana", tier: "INTIMATE" },
  { days: 14, label: "Cada 2 semanas", tier: "INTIMATE" },
  { days: 28, label: "Cada mes", tier: "CLOSE" },
  { days: 56, label: "Cada 2 meses", tier: "CLOSE" },
  { days: 90, label: "Cada 3 meses", tier: "ORBIT" },
  { days: 180, label: "Cada 6 meses", tier: "ORBIT" },
];

export const TIER_LABELS: Record<CircleTier, string> = {
  INTIMATE: "Íntimos",
  CLOSE: "Cercanos",
  ORBIT: "En órbita",
};

/** El tier que le corresponde a una cadencia, para agrupar en la UI. */
export function tierForCadence(cadenceDays: number): CircleTier {
  if (cadenceDays <= 14) return "INTIMATE";
  if (cadenceDays <= 56) return "CLOSE";
  return "ORBIT";
}

export function cadenceLabel(cadenceDays: number): string {
  const preset = CADENCE_PRESETS.find((option) => option.days === cadenceDays);
  if (preset) return preset.label;
  return `Cada ${cadenceDays} días`;
}

/** Lo mínimo que necesita el motor. Cualquier objeto más grande sirve igual. */
export type CadenceInput = {
  cadenceDays: number;
  lastContactAt: Date | null;
  createdAt: Date;
};

export type CadenceState = {
  /** Días desde la última conversación declarada (o desde que lo agregaste). */
  daysSince: number;
  /** Días de más sobre la cadencia. 0 = toca justo hoy, negativo = todavía no. */
  overdueDays: number;
  /** Todavía no declaró ninguna conversación con esta persona. */
  neverContacted: boolean;
  /** ¿Corresponde ponerla adelante hoy? */
  isDue: boolean;
};

/** Días de calendario argentino entre dos instantes. Nunca negativo. */
function daysBetween(from: Date, to: Date): number {
  const diff = startOfDayArg(to).getTime() - startOfDayArg(from).getTime();
  return Math.max(0, Math.round(diff / DAY_MS));
}

export function cadenceState(contact: CadenceInput, today: Date): CadenceState {
  const neverContacted = contact.lastContactAt === null;
  const anchor = contact.lastContactAt ?? contact.createdAt;
  const daysSince = daysBetween(anchor, today);

  // Si nunca declaró una conversación, la persona sale a la superficie enseguida:
  // no tenemos con qué decir que el vínculo esté al día. Al dar de alta, la UI
  // ofrece marcar "hablamos hoy", que es lo que evita el aviso desde el día 1.
  const overdueDays = neverContacted ? daysSince : daysSince - contact.cadenceDays;

  return {
    daysSince,
    overdueDays,
    neverContacted,
    isDue: overdueDays >= 0,
  };
}

/**
 * A quién poner adelante hoy, a partir de contactos que ya traen su estado
 * calculado. La UI usa esta variante: el estado lo calcula el server al
 * serializar, así el cliente no vuelve a leer el reloj (y no hay riesgo de
 * hydration mismatch cruzando la medianoche).
 *
 * Si no toca nadie devuelve vacío: el estado vacío es una respuesta legítima.
 */
export function rankDueContacts<T extends CadenceState & { id: string; cadenceDays: number }>(
  contacts: T[],
  limit = DAILY_SURFACE_LIMIT,
): T[] {
  return contacts
    .filter((contact) => contact.isDue)
    .sort(
      (a, b) =>
        b.overdueDays - a.overdueDays ||
        a.cadenceDays - b.cadenceDays ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}

/** Igual que `rankDueContacts`, pero calculando el estado contra un "hoy" dado. */
export function selectDailyContacts<T extends CadenceInput & { id: string }>(
  contacts: T[],
  today: Date,
  limit = DAILY_SURFACE_LIMIT,
): (T & CadenceState)[] {
  return rankDueContacts(
    contacts.map((contact) => ({ ...contact, ...cadenceState(contact, today) })),
    limit,
  );
}

export type CadenceBudget = {
  /** Conversaciones por día que piden las cadencias cargadas. */
  perDay: number;
  /** Lo mismo, en semanas — es como la gente piensa su semana. */
  perWeek: number;
  /** La lista pide más de lo que una superficie diaria sana puede sostener. */
  isOverloaded: boolean;
};

/**
 * Cuánto pide la lista en régimen. Esto es lo que reemplaza al tope de
 * personas: 50 contactos con cadencia promedio de 8 semanas piden menos de una
 * conversación por día, y eso está perfecto.
 */
export function cadenceBudget(contacts: Pick<CadenceInput, "cadenceDays">[]): CadenceBudget {
  const perDay = contacts.reduce(
    (total, contact) => total + (contact.cadenceDays > 0 ? 1 / contact.cadenceDays : 0),
    0,
  );
  return {
    perDay,
    perWeek: perDay * 7,
    isOverloaded: perDay > OVERLOAD_PER_DAY,
  };
}

/** "hace 3 semanas", "hoy" — para mostrar el tiempo sin vueltas. */
export function sinceLabel(daysSince: number, neverContacted: boolean): string {
  if (neverContacted) return "sin registro";
  if (daysSince === 0) return "hoy";
  if (daysSince === 1) return "ayer";
  if (daysSince < 7) return `hace ${daysSince} días`;
  if (daysSince < 30) {
    const weeks = Math.floor(daysSince / 7);
    return `hace ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
  }
  if (daysSince < 365) {
    const months = Math.floor(daysSince / 30);
    return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
  }
  const years = Math.floor(daysSince / 365);
  return `hace ${years} ${years === 1 ? "año" : "años"}`;
}
