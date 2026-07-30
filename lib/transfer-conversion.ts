export type TransferConversion = {
  destinationAmount: number;
  sourceCurrency: string;
  destinationCurrency: string;
  exchangeRate: number;
  rateBaseCurrency: string;
  rateQuoteCurrency: string;
};

const currencyDecimals = (currency: string) => currency === "BTC" ? 8 : 2;
const roundMoney = (value: number, currency: string) => {
  const factor = 10 ** currencyDecimals(currency);
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/**
 * Convierte entre ARS y una divisa usando una cotización canónica:
 * ARS por 1 unidad de la divisa extranjera.
 * Las transferencias en la misma moneda conservan exactamente el monto.
 */
export function calculateTransferConversion(
  sourceAmount: number,
  sourceCurrency: string,
  destinationCurrency: string,
  arsPerUsd?: number | null,
): TransferConversion {
  if (!Number.isFinite(sourceAmount) || sourceAmount <= 0) {
    throw new Error("El monto debe ser mayor a 0");
  }

  if (sourceCurrency === destinationCurrency) {
    return {
      destinationAmount: roundMoney(sourceAmount, destinationCurrency),
      sourceCurrency,
      destinationCurrency,
      exchangeRate: 1,
      rateBaseCurrency: sourceCurrency,
      rateQuoteCurrency: destinationCurrency,
    };
  }

  const includesArs = sourceCurrency === "ARS" || destinationCurrency === "ARS";
  if (!includesArs) {
    throw new Error("Las conversiones deben incluir una cuenta en pesos argentinos");
  }
  if (!arsPerUsd || !Number.isFinite(arsPerUsd) || arsPerUsd <= 0) {
    throw new Error("Ingresá una cotización válida en ARS por unidad");
  }

  const foreignCurrency = sourceCurrency === "ARS" ? destinationCurrency : sourceCurrency;
  const destinationAmount = sourceCurrency === "ARS"
    ? sourceAmount / arsPerUsd
    : sourceAmount * arsPerUsd;

  return {
    destinationAmount: roundMoney(destinationAmount, destinationCurrency),
    sourceCurrency,
    destinationCurrency,
    exchangeRate: arsPerUsd,
    rateBaseCurrency: foreignCurrency,
    rateQuoteCurrency: "ARS",
  };
}
