import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { startOfMonth, subMonths } from "date-fns";

export type Suscripcion = { nombre: string; montoMensual: number; veces: number; ultima: string };
export type GastoRepetido = { nombre: string; total: number; veces: number; promedio: number };

export type GastosHormiga = {
  suscripciones: Suscripcion[];
  totalSuscripciones: number; // $/mes estimado
  repetidos: GastoRepetido[];
  totalRepetidos: number;
  periodoMeses: number;
};

function toNum(v: unknown): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? 0));
}

// Normaliza la descripción para agrupar: sin acentos, números ni símbolos.
function normalize(desc: string): string {
  return desc
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[0-9]/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Detecta dónde se le escapa la plata al usuario, sobre los últimos meses:
 *  - Suscripciones / cargos recurrentes: misma descripción en ≥2 meses
 *    distintos, ~1 vez por mes y monto estable (ej: Netflix, gimnasio).
 *  - Gastos hormiga: lo mismo repetido muchas veces (ej: café, delivery, kiosco).
 * Las descripciones están cifradas, así que se descifran y agrupan en memoria.
 */
export async function getGastosHormiga(userId: string): Promise<GastosHormiga> {
  const periodoMeses = 4;
  const since = startOfMonth(subMonths(new Date(), periodoMeses - 1));

  const rows = await prisma.transaction.findMany({
    where: { userId, type: "EXPENSE", currency: "ARS", date: { gte: since } },
    select: { amount: true, description: true, date: true, category: { select: { name: true } } },
  });

  type Group = { amounts: number[]; months: Set<string>; count: number; last: Date; label: string };
  const groups = new Map<string, Group>();

  for (const r of rows) {
    const raw = (decrypt(r.description) ?? "").trim();
    const key = normalize(raw) || normalize(r.category?.name ?? "");
    if (key.length < 3) continue; // sin descripción útil → no ensucia el análisis

    const amt = toNum(r.amount);
    const label = raw || r.category?.name || key;
    const g =
      groups.get(key) ?? { amounts: [], months: new Set<string>(), count: 0, last: r.date, label };
    g.amounts.push(amt);
    g.months.add(`${r.date.getFullYear()}-${r.date.getMonth()}`);
    g.count++;
    if (r.date > g.last) g.last = r.date;
    if (raw && raw.length > g.label.length) g.label = raw; // mejor etiqueta vista
    groups.set(key, g);
  }

  const suscripciones: Suscripcion[] = [];
  const repetidos: GastoRepetido[] = [];

  for (const g of groups.values()) {
    const min = Math.min(...g.amounts);
    const max = Math.max(...g.amounts);
    const estable = min > 0 && max / min <= 1.4;

    if (g.months.size >= 2 && estable && g.count <= g.months.size * 2) {
      // Recurrente mensual con monto parejo → suscripción.
      suscripciones.push({
        nombre: g.label,
        montoMensual: Math.round(median(g.amounts)),
        veces: g.count,
        ultima: g.last.toISOString(),
      });
    } else if (g.count >= 4) {
      // Mismo gasto muchas veces → hormiga.
      const total = g.amounts.reduce((s, x) => s + x, 0);
      repetidos.push({
        nombre: g.label,
        total: Math.round(total),
        veces: g.count,
        promedio: Math.round(total / g.count),
      });
    }
  }

  suscripciones.sort((a, b) => b.montoMensual - a.montoMensual);
  repetidos.sort((a, b) => b.total - a.total);

  return {
    suscripciones: suscripciones.slice(0, 12),
    totalSuscripciones: suscripciones.reduce((s, x) => s + x.montoMensual, 0),
    repetidos: repetidos.slice(0, 8),
    totalRepetidos: repetidos.reduce((s, x) => s + x.total, 0),
    periodoMeses,
  };
}
