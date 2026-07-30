export type TransferRateReference = {
  currency: string;
  name: string;
  buy: number;
  sell: number;
  updatedAt: string;
  source: string;
};

const FIAT_NAMES: Record<string, string> = {
  USD: "Dólar oficial",
  EUR: "Euro",
  BRL: "Real brasileño",
  CLP: "Peso chileno",
  UYU: "Peso uruguayo",
};

type DolarApiFiat = {
  compra?: number;
  venta?: number;
  fechaActualizacion?: string;
};

type DolarApiExchange = {
  exchange?: string;
  compra?: number;
  venta?: number;
};

function validRate(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export async function getTransferRateReference(currency: string): Promise<TransferRateReference | null> {
  const code = currency.toUpperCase();

  if (code === "BTC") {
    const response = await fetch("https://dolarapi.com/v1/exchanges/monedas/btc/ars", {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const payload = await response.json() as { value?: DolarApiExchange[] };
    const rows = (payload.value ?? []).filter((row) => validRate(row.compra) && validRate(row.venta));
    if (rows.length === 0) return null;
    const buy = rows.reduce((sum, row) => sum + validRate(row.compra), 0) / rows.length;
    const sell = rows.reduce((sum, row) => sum + validRate(row.venta), 0) / rows.length;
    return {
      currency: "BTC",
      name: "Bitcoin",
      buy,
      sell,
      updatedAt: new Date().toISOString(),
      source: rows.length === 1 && rows[0].exchange
        ? `DolarAPI · ${rows[0].exchange}`
        : `DolarAPI · ${rows.length} exchanges`,
    };
  }

  if (!FIAT_NAMES[code]) return null;
  const endpoint = code === "USD"
    ? "https://dolarapi.com/v1/dolares/oficial"
    : `https://dolarapi.com/v1/cotizaciones/${code.toLowerCase()}`;
  const response = await fetch(endpoint, { next: { revalidate: 300 } });
  if (!response.ok) return null;
  const payload = await response.json() as DolarApiFiat;
  const buy = validRate(payload.compra);
  const sell = validRate(payload.venta);
  if (!buy || !sell) return null;
  return {
    currency: code,
    name: FIAT_NAMES[code],
    buy,
    sell,
    updatedAt: payload.fechaActualizacion ?? new Date().toISOString(),
    source: "DolarAPI",
  };
}
