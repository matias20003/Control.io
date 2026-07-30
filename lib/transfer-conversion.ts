export type TransferConversion = {
  destinationAmount: number;
  sourceCurrency: string;
  destinationCurrency: string;
  exchangeRate: number;
  rateBaseCurrency: string;
  rateQuoteCurrency: string;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Convierte entre ARS y USD usando una cotización canónica: ARS por 1 USD.
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
      destinationAmount: roundMoney(sourceAmount),
      sourceCurrency,
      destinationCurrency,
      exchangeRate: 1,
      rateBaseCurrency: sourceCurrency,
      rateQuoteCurrency: destinationCurrency,
    };
  }

  const supportedPair = new Set([sourceCurrency, destinationCurrency]);
  if (supportedPair.size !== 2 || !supportedPair.has("ARS") || !supportedPair.has("USD")) {
    throw new Error("Por ahora las conversiones entre cuentas están disponibles para ARS y USD");
  }
  if (!arsPerUsd || !Number.isFinite(arsPerUsd) || arsPerUsd <= 0) {
    throw new Error("Ingresá una cotización válida en ARS por USD");
  }

  const destinationAmount = sourceCurrency === "USD"
    ? sourceAmount * arsPerUsd
    : sourceAmount / arsPerUsd;

  return {
    destinationAmount: roundMoney(destinationAmount),
    sourceCurrency,
    destinationCurrency,
    exchangeRate: arsPerUsd,
    rateBaseCurrency: "USD",
    rateQuoteCurrency: "ARS",
  };
}
