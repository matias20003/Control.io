// ─── Funciones puras de cuotas de crédito (sin dependencias de servidor) ───
// Separadas de lib/db/credit.ts (que importa prisma) para poder testearlas
// sin tocar la base de datos.

/**
 * Divide un total en N cuotas de 2 decimales que suman EXACTAMENTE el total.
 * La última cuota absorbe el resto del redondeo, así nunca se pierde ni sobra
 * un centavo (ej: 1000/3 → 333.33 + 333.33 + 333.34 = 1000.00).
 *
 * Devuelve un array vacío si totalInstallments <= 0.
 */
export function splitInstallments(
  totalAmount: number,
  totalInstallments: number
): number[] {
  if (totalInstallments <= 0) return [];
  const rounded = parseFloat((totalAmount / totalInstallments).toFixed(2));
  const last = parseFloat(
    (totalAmount - rounded * (totalInstallments - 1)).toFixed(2)
  );
  return Array.from({ length: totalInstallments }, (_, i) =>
    i === totalInstallments - 1 ? last : rounded
  );
}
