/**
 * Helpers de timezone para Argentina (UTC-3).
 *
 * Vercel corre los servers en UTC, así que `new Date()` + `setHours(0,0,0,0)`
 * da la medianoche UTC, no la de Buenos Aires. Eso provoca que crons y
 * comparaciones de "hoy" se ejecuten contra el día equivocado durante las
 * primeras 3 horas del día (00:00 ARG = 03:00 UTC).
 */

import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { startOfDay, endOfDay } from "date-fns";

export const ARG_TZ = "America/Argentina/Buenos_Aires";

/** Medianoche de hoy en Argentina, devuelta como Date UTC. */
export function startOfTodayArg(): Date {
  const nowInArg = toZonedTime(new Date(), ARG_TZ);
  const startInArg = startOfDay(nowInArg);
  return fromZonedTime(startInArg, ARG_TZ);
}

/** 23:59:59.999 de hoy en Argentina, devuelta como Date UTC. */
export function endOfTodayArg(): Date {
  const nowInArg = toZonedTime(new Date(), ARG_TZ);
  const endInArg = endOfDay(nowInArg);
  return fromZonedTime(endInArg, ARG_TZ);
}

/** Medianoche del Date pasado, interpretado en zona Argentina, en UTC. */
export function startOfDayArg(d: Date): Date {
  const inArg = toZonedTime(d, ARG_TZ);
  return fromZonedTime(startOfDay(inArg), ARG_TZ);
}

/** "YYYY-MM-DD" del día actual según Argentina. Útil para localStorage keys. */
export function todayStringArg(): string {
  const nowInArg = toZonedTime(new Date(), ARG_TZ);
  return nowInArg.toISOString().slice(0, 10);
}

/**
 * Día de la semana y hora actuales según Argentina.
 * weekday: 0=Domingo … 6=Sábado (igual que Date.getDay()). hour: 0–23.
 * Útil para crons que disparan según la preferencia horaria del usuario.
 */
export function nowArgParts(): { weekday: number; hour: number; minute: number } {
  const nowInArg = toZonedTime(new Date(), ARG_TZ);
  return {
    weekday: nowInArg.getDay(),
    hour: nowInArg.getHours(),
    minute: nowInArg.getMinutes(),
  };
}
