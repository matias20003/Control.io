export type DolarRate = {
  type: string;
  name: string;
  buy: number | null;
  sell: number | null;
};

const NAMES: Record<string, string> = {
  oficial: "Dólar Oficial",
  blue: "Dólar Blue",
  bolsa: "Dólar MEP",
  contadoconliqui: "Dólar CCL",
  tarjeta: "Dólar Tarjeta",
  cripto: "Dólar Cripto",
  mayorista: "Dólar Mayorista",
};

export async function getDolarRates(): Promise<DolarRate[]> {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares", {
      next: { revalidate: 600 }, // cache 10 min
    });
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return data
      .filter((d) => ["oficial", "blue", "bolsa", "contadoconliqui", "tarjeta"].includes(d.casa))
      .map((d) => ({
        type: d.casa,
        name: NAMES[d.casa] ?? d.nombre,
        buy: d.compra ?? null,
        sell: d.venta ?? null,
      }));
  } catch {
    return [];
  }
}
