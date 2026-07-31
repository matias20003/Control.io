import type { CotizacionItem } from "@/lib/cotizaciones";

const RATE_ALIASES: Record<string, string> = {
  oficial: "oficial",
  blue: "blue",
  informal: "blue",
  mep: "bolsa",
  bolsa: "bolsa",
  ccl: "contadoconliqui",
  contado: "contadoconliqui",
  liqui: "contadoconliqui",
  tarjeta: "tarjeta",
  turista: "tarjeta",
  cripto: "cripto",
  crypto: "cripto",
  mayorista: "mayorista",
};

const CURRENCY_ALIASES: Record<string, string> = {
  dolar: "USD",
  dolares: "USD",
  usd: "USD",
  euro: "EUR",
  euros: "EUR",
  eur: "EUR",
  real: "BRL",
  reales: "BRL",
  brl: "BRL",
  chileno: "CLP",
  chilenos: "CLP",
  clp: "CLP",
  uruguayo: "UYU",
  uruguayos: "UYU",
  uyu: "UYU",
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type MarketQuery = {
  currency: string;
  type?: string;
  amount?: number;
};

export function parseMarketQuery(message: string): MarketQuery | null {
  const text = normalize(message);
  const hasRateIntent =
    /\b(cotizacion|cotiza|valor|precio|cuanto (esta|vale|valen|sale|salen)|a cuanto|cambio|converti|convertir)\b/.test(text);
  const currency = Object.entries(CURRENCY_ALIASES).find(([alias]) =>
    new RegExp(`\\b${alias}\\b`).test(text)
  )?.[1];
  if (!currency || !hasRateIntent) return null;

  const type = currency === "USD"
    ? Object.entries(RATE_ALIASES).find(([alias]) => new RegExp(`\\b${alias}\\b`).test(text))?.[1]
    : undefined;

  const amountMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(usd|dolares?|eur|euros?|brl|reales?)\b/);
  const amount = amountMatch
    ? Number(amountMatch[1].replace(/\./g, "").replace(",", "."))
    : undefined;

  return { currency, type, amount: Number.isFinite(amount) ? amount : undefined };
}

function ars(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function updatedLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function formatMarketReply(query: MarketQuery, rates: CotizacionItem[]): string | null {
  let matches = rates.filter((rate) => rate.moneda === query.currency);
  if (query.type) matches = matches.filter((rate) => rate.casa === query.type);
  if (!matches.length) return null;

  if (query.amount && matches.length === 1) {
    const rate = matches[0];
    const converted = query.amount * rate.venta;
    return (
      `💱 *${query.amount.toLocaleString("es-AR")} ${rate.moneda}* son aproximadamente *${ars(converted)}* ` +
      `usando ${rate.nombre} vendedor (${ars(rate.venta)}).\n\n` +
      `_Actualizado ${updatedLabel(rate.fetchedAt)} · Fuente: DolarAPI_`
    );
  }

  const lines = matches.map((rate) =>
    `• *${rate.nombre}:* compra ${ars(rate.compra)} · venta ${ars(rate.venta)}`
  );
  const latest = matches.reduce((best, rate) =>
    Date.parse(rate.fetchedAt) > Date.parse(best) ? rate.fetchedAt : best, matches[0].fetchedAt);
  const title = query.currency === "USD" ? "Cotización del dólar" : `Cotización ${query.currency}`;
  return `💵 *${title}*\n\n${lines.join("\n")}\n\n_Actualizado ${updatedLabel(latest)} · Fuente: DolarAPI_`;
}

export function formatRatesForContext(rates: CotizacionItem[]): string {
  if (!rates.length) return "- No hay cotizaciones disponibles en este momento.";
  return rates
    .map((rate) => `- ${rate.moneda} ${rate.nombre}: compra ${rate.compra}, venta ${rate.venta}`)
    .join("\n");
}
