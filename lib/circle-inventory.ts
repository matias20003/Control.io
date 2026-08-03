/**
 * Mi Círculo · La Mudanza — lectura del export de datos de Instagram.
 *
 * Instagram deja descargar tus propios datos (Centro de cuentas → Descargar tu
 * información). El paquete incluye `following.json` con las cuentas que seguís.
 * Es un export legítimo, iniciado por el usuario, sobre datos propios: no es
 * scraping y no viola términos. Ver docs/MI_CIRCULO.md.
 *
 * Puro: recibe el JSON ya leído. Meta cambia el formato cada tanto, así que
 * acepta las tres formas que viene usando y ante la duda descarta la entrada en
 * vez de inventar un handle.
 */

export type InventoryEntry = {
  handle: string;
  fullName: string | null;
};

/** Un handle de Instagram: letras, números, punto y guion bajo. */
function cleanHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/^@/, "").toLowerCase();
  if (!clean || clean.length > 30) return null;
  return /^[a-z0-9._]+$/.test(clean) ? clean : null;
}

/** El handle escondido en una URL de perfil, cuando no viene el campo `value`. */
function handleFromHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  try {
    const url = new URL(href);
    if (!url.hostname.toLowerCase().includes("instagram.com")) return null;
    const first = url.pathname.split("/").filter(Boolean)[0];
    return cleanHandle(first);
  } catch {
    return null;
  }
}

type StringListItem = { value?: unknown; href?: unknown };

function fromStringList(node: unknown): InventoryEntry | null {
  if (!node || typeof node !== "object") return null;
  const record = node as { string_list_data?: unknown; title?: unknown };
  const list = record.string_list_data;
  if (!Array.isArray(list) || list.length === 0) return null;

  const first = list[0] as StringListItem;
  const handle = cleanHandle(first?.value) ?? handleFromHref(first?.href);
  if (!handle) return null;

  const title = typeof record.title === "string" ? record.title.trim() : "";
  return { handle, fullName: title && title !== handle ? title : null };
}

/**
 * Las cuentas que seguís, a partir del contenido de `following.json`.
 *
 * Formas aceptadas:
 *   { "relationships_following": [ … ] }   ← la actual
 *   [ … ]                                  ← exports viejos
 *   { "following": [ … ] }                 ← variante
 */
export function parseFollowingExport(data: unknown): InventoryEntry[] {
  let lista: unknown = null;

  if (Array.isArray(data)) {
    lista = data;
  } else if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    lista =
      record.relationships_following ??
      record.following ??
      record.relationships_follow_requests_sent ??
      null;
  }

  if (!Array.isArray(lista)) return [];

  const vistos = new Set<string>();
  const entradas: InventoryEntry[] = [];
  for (const node of lista) {
    const entrada = fromStringList(node);
    if (!entrada || vistos.has(entrada.handle)) continue;
    vistos.add(entrada.handle);
    entradas.push(entrada);
  }
  return entradas;
}

/** Parsea el texto crudo del archivo. Un JSON roto devuelve vacío, no explota. */
export function parseFollowingFile(raw: string): InventoryEntry[] {
  try {
    return parseFollowingExport(JSON.parse(raw));
  } catch {
    return [];
  }
}

export const INVENTORY_DECISIONS = ["PENDING", "PERSON", "REFERENCE", "NOISE"] as const;
export type InventoryDecision = (typeof INVENTORY_DECISIONS)[number];

export type InventoryProgress = {
  total: number;
  pending: number;
  classified: number;
  people: number;
  references: number;
  noise: number;
  /** 0–100, cuánto del inventario ya está clasificado. */
  percent: number;
};

export function inventoryProgress(
  decisions: { decision: string }[],
): InventoryProgress {
  const contar = (valor: string) =>
    decisions.filter((item) => item.decision === valor).length;

  const total = decisions.length;
  const pending = contar("PENDING");
  const classified = total - pending;

  return {
    total,
    pending,
    classified,
    people: contar("PERSON"),
    references: contar("REFERENCE"),
    noise: contar("NOISE"),
    percent: total === 0 ? 0 : Math.round((classified / total) * 100),
  };
}

export const MIGRATION_STAGES = [
  "INVENTORY",
  "REPLACE",
  "COEXIST",
  "CUT",
  "AFTER",
] as const;
export type MigrationStage = (typeof MIGRATION_STAGES)[number];

/**
 * Las etapas que se recorren DENTRO de La Mudanza.
 *
 * `INVENTORY` quedó afuera a propósito: mirarse al espejo dejó de ser la etapa
 * 0 de un proceso opcional y pasó a ser la puerta de entrada de la sección —
 * es el momento más persuasivo que tiene el producto y la única forma de
 * capturar la línea de base. El valor sigue existiendo en la base para las
 * mudanzas que ya venían arrancadas.
 */
export const MUDANZA_STAGES: MigrationStage[] = MIGRATION_STAGES.filter(
  (stage) => stage !== "INVENTORY",
);

export const STAGE_LABELS: Record<MigrationStage, string> = {
  INVENTORY: "El inventario",
  REPLACE: "El reemplazo",
  COEXIST: "La convivencia",
  CUT: "El corte",
  AFTER: "La vida después",
};

export const STAGE_DESCRIPTIONS: Record<MigrationStage, string> = {
  INVENTORY:
    "Antes de sacar nada, ver qué hay. Eso ahora se hace en El Espejo, apenas entrás a la sección.",
  REPLACE:
    "Por cada referente buscamos su canal propio. Por cada persona, su teléfono.",
  COEXIST:
    "Dos o tres semanas con Instagram todavía instalado. Sin prohibiciones: es una prueba.",
  CUT: "Con el checklist cubierto, desinstalar. Si la volvés a instalar, no pasa nada.",
  AFTER:
    "Lo que quedó en su lugar: conversaciones reales, piezas convertidas, tiempo devuelto.",
};

export type CutChecklist = {
  peopleWithPhone: number;
  peopleTotal: number;
  referencesWithChannel: number;
  referencesTotal: number;
  pendingInventory: number;
  /** ¿Está en condiciones de cortar sin quedarse sin nada? */
  ready: boolean;
  blockers: string[];
};

/**
 * El checklist previo al corte. Cortar antes de tener el reemplazo listo falla
 * siempre, así que esto es un freno a propósito — pero informa, no prohíbe.
 */
export function cutChecklist(input: {
  peopleWithPhone: number;
  peopleTotal: number;
  referencesWithChannel: number;
  referencesTotal: number;
  pendingInventory: number;
}): CutChecklist {
  const blockers: string[] = [];

  if (input.peopleTotal === 0) {
    blockers.push("Todavía no cargaste a nadie en Cercanos.");
  } else if (input.peopleWithPhone < input.peopleTotal) {
    const faltan = input.peopleTotal - input.peopleWithPhone;
    blockers.push(
      `${faltan} ${faltan === 1 ? "persona" : "personas"} sin teléfono: si desinstalás, perdés el contacto.`,
    );
  }

  if (input.referencesTotal > 0 && input.referencesWithChannel < input.referencesTotal) {
    const huerfanos = input.referencesTotal - input.referencesWithChannel;
    blockers.push(
      `${huerfanos} ${huerfanos === 1 ? "referente" : "referentes"} sin canal propio.`,
    );
  }

  if (input.pendingInventory > 0) {
    blockers.push(`${input.pendingInventory} cuentas del inventario sin clasificar.`);
  }

  return { ...input, ready: blockers.length === 0, blockers };
}
