// ─── Tipos y funciones puras de grupos (sin dependencias de servidor) ───
// Este archivo puede importarse desde Client Components.
// lib/db/grupos.ts contiene las queries de DB (server-only).

export type SerializedMiembro = {
  id: string;
  nombre: string;
  email: string | null;
  userId: string | null;
  esCreador: boolean;
  uniEn: string;
};

export type SerializedDivision = {
  id: string;
  miembroId: string;
  monto: number;
};

export type SerializedGasto = {
  id: string;
  descripcion: string;
  monto: number;
  pagadoPorId: string;
  pagadoPorNombre: string;
  fecha: string;
  divisiones: SerializedDivision[];
};

export type SerializedGrupo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  userId: string;
  creadoEn: string;
  archivadoEn: string | null;
  miembros: SerializedMiembro[];
  totalGastos: number;
  cantidadMiembros: number;
};

export type SerializedGrupoDetalle = SerializedGrupo & {
  gastos: SerializedGasto[];
  balances: Balance[];
  liquidacion: Pago[];
};

export type Balance = {
  miembroId: string;
  nombre: string;
  balance: number; // positivo = le deben, negativo = debe
};

export type Pago = {
  deudorId: string;
  deudorNombre: string;
  acreedorId: string;
  acreedorNombre: string;
  monto: number;
};

// ─── Calcular balances ───

export function calcularBalances(
  miembros: SerializedMiembro[],
  gastos: SerializedGasto[]
): Balance[] {
  const pagado: Record<string, number> = {};
  const debido: Record<string, number> = {};

  for (const m of miembros) {
    pagado[m.id] = 0;
    debido[m.id] = 0;
  }

  for (const g of gastos) {
    pagado[g.pagadoPorId] = (pagado[g.pagadoPorId] ?? 0) + g.monto;
    for (const d of g.divisiones) {
      debido[d.miembroId] = (debido[d.miembroId] ?? 0) + d.monto;
    }
  }

  return miembros.map((m) => ({
    miembroId: m.id,
    nombre: m.nombre,
    balance: (pagado[m.id] ?? 0) - (debido[m.id] ?? 0),
  }));
}

// ─── Algoritmo de liquidación simplificada ───

export function calcularLiquidacion(balances: Balance[]): Pago[] {
  const pagos: Pago[] = [];
  const deudores = balances
    .filter((b) => b.balance < -0.01)
    .map((b) => ({ ...b, balance: Math.round(b.balance * 100) }))
    .sort((a, b) => a.balance - b.balance);

  const acreedores = balances
    .filter((b) => b.balance > 0.01)
    .map((b) => ({ ...b, balance: Math.round(b.balance * 100) }))
    .sort((a, b) => b.balance - a.balance);

  let i = 0;
  let j = 0;

  while (i < deudores.length && j < acreedores.length) {
    const deudor = deudores[i];
    const acreedor = acreedores[j];
    const monto = Math.min(-deudor.balance, acreedor.balance);

    pagos.push({
      deudorId: deudor.miembroId,
      deudorNombre: deudor.nombre,
      acreedorId: acreedor.miembroId,
      acreedorNombre: acreedor.nombre,
      monto: monto / 100,
    });

    deudor.balance += monto;
    acreedor.balance -= monto;

    if (Math.abs(deudor.balance) < 1) i++;
    if (Math.abs(acreedor.balance) < 1) j++;
  }

  return pagos;
}
