import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Ruta temporal para corregir divisiones de grupos existentes.
// Después de ejecutarla UNA vez, se puede eliminar este archivo.
export async function GET() {
  const grupos = await prisma.grupoGasto.findMany({ select: { id: true } });
  const log: string[] = [];

  for (const grupo of grupos) {
    const miembros = await prisma.miembroGrupo.findMany({ where: { grupoId: grupo.id } });
    const gastos = await prisma.gastoGrupo.findMany({ where: { grupoId: grupo.id, tipo: "igual" } });

    for (const gasto of gastos) {
      const montoPorMiembro =
        Math.round((parseFloat(gasto.monto.toString()) / miembros.length) * 100) / 100;

      await prisma.divisionGasto.deleteMany({ where: { gastoId: gasto.id } });
      await prisma.divisionGasto.createMany({
        data: miembros.map((m) => ({
          gastoId: gasto.id,
          miembroId: m.id,
          monto: montoPorMiembro,
        })),
      });
    }

    log.push(`Grupo ${grupo.id}: ${miembros.length} miembros, ${gastos.length} gastos recalculados`);
  }

  return NextResponse.json({ ok: true, log });
}
