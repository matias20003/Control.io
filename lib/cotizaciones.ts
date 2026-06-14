/**
 * Cotizaciones de monedas desde dolarapi.com (gratis, sin auth).
 * - USD: todos los tipos (oficial, blue, MEP, CCL, tarjeta, cripto, mayorista).
 * - Otras monedas populares (EUR, BRL, CLP, UYU): cotización oficial.
 * Cachea en la tabla ExchangeRate por 10 minutos. Fallback a bluelytics para USD.
 */
import { prisma } from "@/lib/prisma";

export type CotizacionItem = {
  moneda: string;       // "USD" | "EUR" | "BRL" | "CLP" | "UYU"
  casa: string;         // "blue" | "oficial" | "bolsa" | "contadoconliqui" | "tarjeta" | "cripto" | "mayorista"
  nombre: string;
  compra: number;
  venta: number;
  fetchedAt: string;
};

const STALE_MS = 10 * 60 * 1000; // 10 minutos

// Nombres lindos para los tipos de dólar.
const NAME_MAP: Record<string, string> = {
  oficial:          "Oficial",
  blue:             "Blue",
  bolsa:            "MEP / Bolsa",
  contadoconliqui:  "CCL",
  tarjeta:          "Tarjeta / Turista",
  cripto:           "Cripto",
  mayorista:        "Mayorista",
};

// Monedas distintas al dólar que mostramos (las más buscadas en Argentina).
const OTHER_CURRENCIES: Record<string, string> = {
  EUR: "Euro",
  BRL: "Real brasileño",
  CLP: "Peso chileno",
  UYU: "Peso uruguayo",
};

async function fetchFromDolarApi(): Promise<CotizacionItem[]> {
  const res = await fetch("https://dolarapi.com/v1/dolares", { next: { revalidate: 0 } });
  if (!res.ok) throw new Error("dolarapi.com failed");
  const data = await res.json();
  const now = new Date().toISOString();
  return (data as any[]).map((d) => ({
    moneda: "USD",
    casa: d.casa,
    nombre: NAME_MAP[d.casa] ?? d.nombre ?? d.casa,
    compra: Number(d.compra) || 0,
    venta: Number(d.venta) || 0,
    fetchedAt: now,
  }));
}

async function fetchOtherCurrencies(): Promise<CotizacionItem[]> {
  const res = await fetch("https://dolarapi.com/v1/cotizaciones", { next: { revalidate: 0 } });
  if (!res.ok) throw new Error("dolarapi cotizaciones failed");
  const data = await res.json();
  const now = new Date().toISOString();
  return (data as any[])
    .filter((d) => d.moneda && OTHER_CURRENCIES[d.moneda])
    .map((d) => ({
      moneda: d.moneda,
      casa: d.casa ?? "oficial",
      nombre: OTHER_CURRENCIES[d.moneda],
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
  if (d.oficial)  result.push({ moneda: "USD", casa: "oficial", nombre: "Oficial",  compra: d.oficial.value_buy,  venta: d.oficial.value_sell,  fetchedAt: now });
  if (d.blue)     result.push({ moneda: "USD", casa: "blue",    nombre: "Blue",     compra: d.blue.value_buy,     venta: d.blue.value_sell,     fetchedAt: now });
  return result;
}

async function saveRates(items: CotizacionItem[]): Promise<void> {
  for (const item of items) {
    if (!item.compra && !item.venta) continue;
    await prisma.exchangeRate.create({
      data: {
        type: item.casa,
        currency: item.moneda,
        buyRate:  item.compra,
        sellRate: item.venta,
        fetchedAt: new Date(item.fetchedAt),
      },
    }).catch(() => {});
  }
}

// Orden de presentación: dólar primero (por tipo), después las otras monedas.
const USD_ORDER = ["oficial", "blue", "mayorista", "bolsa", "contadoconliqui", "tarjeta", "cripto"];
const CURRENCY_ORDER = ["USD", "EUR", "BRL", "CLP", "UYU"];

function sortItems(items: CotizacionItem[]): CotizacionItem[] {
  return items.sort((a, b) => {
    const ca = CURRENCY_ORDER.indexOf(a.moneda);
    const cb = CURRENCY_ORDER.indexOf(b.moneda);
    if (ca !== cb) return ca - cb;
    return USD_ORDER.indexOf(a.casa) - USD_ORDER.indexOf(b.casa);
  });
}

/** Trae cotizaciones frescas (de caché o de la API externa). */
export async function getCotizaciones(): Promise<CotizacionItem[]> {
  // Frescura por separado para USD y para las otras monedas: si las "otras"
  // nunca se trajeron (o quedaron viejas), refrescamos aunque USD esté fresco.
  const [latestUsd, latestOther] = await Promise.all([
    prisma.exchangeRate.findFirst({ where: { currency: "USD" }, orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
    prisma.exchangeRate.findFirst({ where: { currency: { not: "USD" } }, orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
  ]);
  const fresh = (d: { fetchedAt: Date } | null) => !!d && Date.now() - d.fetchedAt.getTime() < STALE_MS;
  const isFresh = fresh(latestUsd) && fresh(latestOther);

  if (!isFresh) {
    // USD y otras monedas en paralelo; si una falla, guardamos lo que haya.
    const [usd, others] = await Promise.allSettled([fetchFromDolarApi(), fetchOtherCurrencies()]);
    if (usd.status === "fulfilled") await saveRates(usd.value);
    else {
      try { await saveRates(await fetchFromBluelytics()); } catch {}
    }
    if (others.status === "fulfilled") await saveRates(others.value);
  }

  // Última cotización por (moneda, tipo).
  const rows = await prisma.exchangeRate.findMany({
    orderBy: { fetchedAt: "desc" },
    distinct: ["currency", "type"],
    take: 40,
  });

  return sortItems(
    rows.map((r) => ({
      moneda: r.currency,
      casa: r.type,
      nombre: r.currency === "USD" ? (NAME_MAP[r.type] ?? r.type) : (OTHER_CURRENCIES[r.currency] ?? r.currency),
      compra: parseFloat(r.buyRate.toString()),
      venta: parseFloat(r.sellRate.toString()),
      fetchedAt: r.fetchedAt.toISOString(),
    }))
  );
}

/** Fuerza un refresh desde la API externa. */
export async function refreshCotizaciones(): Promise<CotizacionItem[]> {
  const [usd, others] = await Promise.allSettled([fetchFromDolarApi(), fetchOtherCurrencies()]);
  if (usd.status === "fulfilled") await saveRates(usd.value);
  else { try { await saveRates(await fetchFromBluelytics()); } catch {} }
  if (others.status === "fulfilled") await saveRates(others.value);
  return getCotizaciones();
}
