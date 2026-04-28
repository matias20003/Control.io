/**
 * Fetches and caches USD exchange rates from dolarapi.com (free, no auth).
 * Falls back to bluelytics.com.ar if the primary API fails.
 * Caches results in the ExchangeRate table for 10 minutes.
 */
import { prisma } from "@/lib/prisma";

export type CotizacionItem = {
  casa: string;         // "blue" | "oficial" | "bolsa" | "contadoconliqui" | "tarjeta" | "cripto" | "mayorista"
  nombre: string;
  compra: number;
  venta: number;
  fetchedAt: string;
};

const STALE_MS = 10 * 60 * 1000; // 10 minutos

const NAME_MAP: Record<string, string> = {
  oficial:          "Oficial",
  blue:             "Blue",
  bolsa:            "MEP / Bolsa",
  contadoconliqui:  "CCL",
  tarjeta:          "Tarjeta / Turista",
  cripto:           "Cripto",
  mayorista:        "Mayorista",
};

async function fetchFromDolarApi(): Promise<CotizacionItem[]> {
  const res = await fetch("https://dolarapi.com/v1/dolares", { next: { revalidate: 0 } });
  if (!res.ok) throw new Error("dolarapi.com failed");
  const data = await res.json();
  const now = new Date().toISOString();
  return (data as any[]).map((d) => ({
    casa: d.casa,
    nombre: NAME_MAP[d.casa] ?? d.nombre ?? d.casa,
    compra: Number(d.compra) || 0,
    venta: Number(d.venta) || 0,
    fetchedAt: now,
  }));
}

async function fetchFromBluelytics(): Promise<CotizacionItem[]> {
  const res = await fetch("https://api.bluelytics.com.ar/v2/latest", { next: { revalidate: 0 } });
  if (!res.ok) throw new Error("bluelytics failed");
  const d = await res.json();
  const now = new Date().toISOString();
  const result: CotizacionItem[] = [];
  if (d.oficial)  result.push({ casa: "oficial", nombre: "Oficial",  compra: d.oficial.value_buy,  venta: d.oficial.value_sell,  fetchedAt: now });
  if (d.blue)     result.push({ casa: "blue",    nombre: "Blue",     compra: d.blue.value_buy,     venta: d.blue.value_sell,     fetchedAt: now });
  return result;
}

async function saveRates(items: CotizacionItem[]): Promise<void> {
  for (const item of items) {
    if (!item.compra && !item.venta) continue;
    await prisma.exchangeRate.create({
      data: {
        type: item.casa,
        currency: "USD",
        buyRate:  item.compra,
        sellRate: item.venta,
        fetchedAt: new Date(item.fetchedAt),
      },
    }).catch(() => {});
  }
}

/** Returns fresh cotizaciones (from cache or external API). */
export async function getCotizaciones(): Promise<CotizacionItem[]> {
  // Check freshness
  const latest = await prisma.exchangeRate.findFirst({
    where: { currency: "USD" },
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });

  const isFresh = latest && (Date.now() - latest.fetchedAt.getTime()) < STALE_MS;

  if (!isFresh) {
    try {
      const items = await fetchFromDolarApi();
      await saveRates(items);
    } catch {
      try {
        const items = await fetchFromBluelytics();
        await saveRates(items);
      } catch {
        // If both fail, use cached data below
      }
    }
  }

  // Read from DB (distinct latest per type)
  const rows = await prisma.exchangeRate.findMany({
    where: { currency: "USD" },
    orderBy: { fetchedAt: "desc" },
    distinct: ["type"],
    take: 20,
  });

  const ORDER = ["oficial", "blue", "mayorista", "bolsa", "contadoconliqui", "tarjeta", "cripto"];

  return rows
    .map((r) => ({
      casa: r.type,
      nombre: NAME_MAP[r.type] ?? r.type,
      compra: parseFloat(r.buyRate.toString()),
      venta: parseFloat(r.sellRate.toString()),
      fetchedAt: r.fetchedAt.toISOString(),
    }))
    .sort((a, b) => ORDER.indexOf(a.casa) - ORDER.indexOf(b.casa));
}

/** Fuerza un refresh desde la API externa. */
export async function refreshCotizaciones(): Promise<CotizacionItem[]> {
  try {
    const items = await fetchFromDolarApi();
    await saveRates(items);
    return items;
  } catch {
    return fetchFromBluelytics();
  }
}
