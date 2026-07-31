/**
 * Vocabulario de los "avisos" del dashboard (onboarding, recordatorios,
 * novedades). Todos viven apilados dentro de una misma tarjeta neutra: antes
 * eran cuatro bloques grandes de colores distintos que empujaban los números
 * fuera de la pantalla en mobile. Cada aviso es una fila de una sola altura,
 * con una acción a la derecha.
 */

export const NOTICE_ROW = "flex w-full items-center gap-3 px-4 py-3 text-left";

export const NOTICE_TITLE = "text-sm font-medium leading-tight text-foreground";

export const NOTICE_BODY = "mt-0.5 text-xs leading-snug text-muted";

/** Ícono de la izquierda. El color lo pone cada aviso. */
export const NOTICE_ICON = "grid h-9 w-9 shrink-0 place-items-center rounded-xl";

/** Acción principal — 44px de alto para que se pueda tocar con el pulgar. */
export const NOTICE_ACTION =
  "inline-flex h-11 shrink-0 items-center rounded-lg px-3.5 text-xs font-semibold transition-colors";

/** Cerrar. Sin fondo: no compite con la acción. */
export const NOTICE_DISMISS =
  "grid h-11 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground";
