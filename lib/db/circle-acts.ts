/**
 * Mi Círculo · los actos valiosos.
 *
 * Qué cuenta como acto: convertir una lectura en algo, declarar una
 * conversación real. Qué NO cuenta: abrir la app, leer una pieza, pasar tiempo
 * adentro. Esa lista es la regla entera del sistema de recompensa — si algún
 * día entra acá una métrica de consumo, la sección se volvió Instagram con
 * mejor contenido.
 */

import { prisma } from "@/lib/prisma";

/** Cuánto historial mira la racha. Trece semanas alcanzan y de sobra. */
const WINDOW_DAYS = 91;

/**
 * Las fechas de los actos valiosos, para calcular la racha semanal.
 * Devuelve fechas sueltas a propósito: el motor de la racha es puro y no sabe
 * de dónde salieron.
 */
export async function getValuableActDates(
  userId: string,
  today = new Date(),
): Promise<Date[]> {
  const since = new Date(today.getTime() - WINDOW_DAYS * 86_400_000);

  const [harvests, touches] = await Promise.all([
    prisma.circleHarvest.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.circleTouch.findMany({
      where: { userId, happenedAt: { gte: since } },
      select: { happenedAt: true },
    }),
  ]);

  return [
    ...harvests.map((row) => row.createdAt),
    ...touches.map((row) => row.happenedAt),
  ];
}

/**
 * Cuándo empezó todo, para saber cuánta maquinaria corresponde hoy.
 *
 * Se prefiere el día que se miró al espejo: es el momento en que la persona
 * eligió esto de verdad. Si nunca subió su inventario, vale la fecha del primer
 * rastro que dejó en la sección.
 */
export async function getCircleStartedAt(userId: string): Promise<Date | null> {
  const [migration, firstFront, firstContact] = await Promise.all([
    prisma.circleMigration.findUnique({
      where: { userId },
      select: { inventoryUploadedAt: true },
    }),
    prisma.circleFront.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.circleContact.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  if (migration?.inventoryUploadedAt) return migration.inventoryUploadedAt;

  const candidatos = [firstFront?.createdAt, firstContact?.createdAt].filter(
    (date): date is Date => Boolean(date),
  );
  if (candidatos.length === 0) return null;
  return candidatos.reduce((a, b) => (a < b ? a : b));
}
