import { prisma } from "@/lib/prisma";
import {
  calcularBalances,
  calcularLiquidacion,
  type SerializedMiembro,
  type SerializedGasto,
  type SerializedGrupo,
  type SerializedGrupoDetalle,
} from "@/lib/db/grupos-utils";

// Re-exportar todo para que otros server-files puedan importar desde un solo lugar
export * from "@/lib/db/grupos-utils";

// ─── Helpers de serialización ───

function toNum(d: { toString(): string } | number): number {
  return typeof d === "number" ? d : parseFloat(d.toString());
}

// ─── Queries ───

export async function getGrupos(userId: string): Promise<SerializedGrupo[]> {
  const grupos = await prisma.grupoGasto.findMany({
    where: {
      OR: [
        { userId },
        { miembros: { some: { userId } } },
      ],
      archivadoEn: null,
    },
    include: {
      miembros: true,
      gastos: { select: { monto: true } },
    },
    orderBy: { creadoEn: "desc" },
  });

  return grupos.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    descripcion: g.descripcion,
    userId: g.userId,
    creadoEn: g.creadoEn.toISOString(),
    archivadoEn: g.archivadoEn?.toISOString() ?? null,
    miembros: g.miembros.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      email: m.email,
      userId: m.userId,
      esCreador: m.esCreador,
      uniEn: m.uniEn.toISOString(),
    })),
    totalGastos: g.gastos.reduce((s, gx) => s + toNum(gx.monto), 0),
    cantidadMiembros: g.miembros.length,
  }));
}

export async function getGrupoDetalle(
  grupoId: string,
  userId: string
): Promise<SerializedGrupoDetalle | null> {
  const grupo = await prisma.grupoGasto.findFirst({
    where: {
      id: grupoId,
      OR: [
        { userId },
        { miembros: { some: { userId } } },
      ],
    },
    include: {
      miembros: true,
      gastos: {
        include: { divisiones: true, pagadoPor: true },
        orderBy: { fecha: "desc" },
      },
    },
  });

  if (!grupo) return null;

  const miembros: SerializedMiembro[] = grupo.miembros.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    email: m.email,
    userId: m.userId,
    esCreador: m.esCreador,
    uniEn: m.uniEn.toISOString(),
  }));

  const gastos: SerializedGasto[] = grupo.gastos.map((g) => ({
    id: g.id,
    descripcion: g.descripcion,
    monto: toNum(g.monto),
    pagadoPorId: g.pagadoPorId,
    pagadoPorNombre: g.pagadoPor.nombre,
    fecha: g.fecha.toISOString(),
    divisiones: g.divisiones.map((d) => ({
      id: d.id,
      miembroId: d.miembroId,
      monto: toNum(d.monto),
    })),
  }));

  const balances = calcularBalances(miembros, gastos);
  const liquidacion = calcularLiquidacion(balances);

  return {
    id: grupo.id,
    nombre: grupo.nombre,
    descripcion: grupo.descripcion,
    userId: grupo.userId,
    creadoEn: grupo.creadoEn.toISOString(),
    archivadoEn: grupo.archivadoEn?.toISOString() ?? null,
    miembros,
    gastos,
    totalGastos: gastos.reduce((s, g) => s + g.monto, 0),
    cantidadMiembros: miembros.length,
    balances,
    liquidacion,
  };
}

export async function getInvitacionByToken(token: string) {
  return prisma.grupoInvitacion.findUnique({
    where: { token },
    include: { grupo: { include: { miembros: true } } },
  });
}
