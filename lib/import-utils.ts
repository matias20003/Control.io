// ─── Helpers puros para importar CSV de MercadoPago / banco ───
// Sin dependencias de servidor → testeables.

function pad(s: string): string {
  return s.padStart(2, "0");
}

/**
 * Parsea un monto en formatos AR ("1.234,56"), US ("1,234.56"), con signo,
 * paréntesis para negativos y símbolos de moneda. Devuelve número con signo o null.
 */
export function parseAmount(raw: unknown): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  const negative = s.startsWith("-") || /^\(.*\)$/.test(s) || s.endsWith("-");
  s = s.replace(/[^\d.,]/g, ""); // dejamos solo dígitos y separadores
  if (!s) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  // Determinar el separador DECIMAL (el de más a la derecha si hay ambos).
  let decSep = "";
  if (lastDot >= 0 && lastComma >= 0) {
    decSep = lastDot > lastComma ? "." : ",";
  } else if (lastComma >= 0) {
    decSep = s.length - lastComma - 1 <= 2 ? "," : "";
  } else if (lastDot >= 0) {
    decSep = s.length - lastDot - 1 <= 2 ? "." : "";
  }

  let normalized: string;
  if (decSep) {
    const thousands = decSep === "." ? "," : ".";
    normalized = s.split(thousands).join("").replace(decSep, ".");
  } else {
    normalized = s.replace(/[.,]/g, ""); // todos son separadores de miles
  }

  const n = parseFloat(normalized);
  if (isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/**
 * Parsea una fecha en formatos comunes (dd/mm/aaaa AR, aaaa-mm-dd, dd-mm-aa…)
 * y devuelve "YYYY-MM-DD" o null. Asume día/mes (formato argentino) cuando es ambiguo.
 */
export function parseDate(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO: aaaa-mm-dd o aaaa/mm/dd
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  // dd/mm/aaaa o dd-mm-aa
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const d = m[1];
    const mo = m[2];
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${pad(mo)}-${pad(d)}`;
  }

  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

/** Detecta qué columna del CSV corresponde a cada campo, por el nombre del header. */
export function detectColumns(headers: string[]): {
  date: string | null;
  description: string | null;
  amount: string | null;
  debit: string | null;
  credit: string | null;
} {
  const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
  const norm = (h: string) => h.toLowerCase().normalize("NFD").replace(DIACRITICS, "").trim();
  const find = (re: RegExp) => headers.find((h) => re.test(norm(h))) ?? null;
  return {
    date: find(/fecha|date|dia/),
    description: find(/descrip|detalle|concepto|referencia|motivo|comercio|titulo|nombre/),
    amount: find(/monto|importe|valor|amount|total|neto/),
    debit: find(/debito|egreso|cargo|salida/),
    credit: find(/credito|ingreso|abono|deposito|entrada/),
  };
}
