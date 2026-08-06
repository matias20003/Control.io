/**
 * Patrimonio neto: convertir posiciones a pesos y reconstruir su historia.
 *
 * Vive acá, y no adentro de la tarjeta que lo mostraba, porque ahora lo muestran
 * dos pantallas. Mientras cada una hacía su propia cuenta daban números
 * distintos: el Inicio sumaba sólo la posición en pesos y Finanzas sumaba todas
 * las monedas convertidas, así que el mismo patrimonio aparecía con dos valores
 * en la misma app. Con una sola función no pueden volver a separarse.
 */

export type CurrencyPosition = {
  currency: string;
  assets: number;
  liabilities: number;
  net: number;
};

export type NetWorthTotals = {
  assets: number;
  liabilities: number;
  net: number;
  /** Monedas sin cotización disponible, que quedaron fuera del total. */
  missing: number;
};

/**
 * Pasa todas las posiciones a pesos.
 *
 * `rates` mapea moneda → cuántos pesos vale una unidad. El peso vale uno y no
 * necesita entrada. Una moneda sin cotización no se cuenta como cero: se
 * informa aparte, porque un total al que le falta un pedazo y no lo dice es
 * peor que un total incompleto y anunciado.
 */
export function convertPositions(
  positions: CurrencyPosition[],
  rates: Record<string, number>,
): NetWorthTotals {
  let assets = 0;
  let liabilities = 0;
  let missing = 0;

  for (const position of positions) {
    const rate = position.currency === "ARS" ? 1 : rates[position.currency];
    if (!rate || !Number.isFinite(rate) || rate <= 0) {
      missing++;
      continue;
    }
    assets += position.assets * rate;
    liabilities += position.liabilities * rate;
  }

  return { assets, liabilities, net: assets - liabilities, missing };
}

/**
 * La historia del patrimonio, reconstruida hacia atrás.
 *
 * No hay foto guardada del patrimonio de cada mes, así que se ancla en el de
 * hoy —que sí es un dato— y se camina hacia atrás restando lo que dejó cada
 * mes. El último punto es siempre exacto; los anteriores son la mejor
 * reconstrucción posible con lo que hay.
 */
export function netWorthSeries(
  monthlyBalances: { label: string; balance: number }[],
  netToday: number,
): { label: string; patrimonio: number }[] {
  if (!monthlyBalances.length) return [];
  const out: { label: string; patrimonio: number }[] = [];
  let running = netToday;
  for (let index = monthlyBalances.length - 1; index >= 0; index--) {
    out[index] = { label: monthlyBalances[index].label, patrimonio: Math.round(running) };
    running -= monthlyBalances[index].balance;
  }
  return out;
}
