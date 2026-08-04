import "server-only";
import { prisma } from "@/lib/prisma";
import { hasFeature, type FeatureFlag } from "@/lib/feature-flags";

/**
 * Qué pestañas con feature flag puede ver este usuario.
 *
 * Las páginas de un mismo grupo comparten la barra de secciones, así que todas
 * necesitan la misma respuesta. Resolverlo acá evita repetir la consulta de
 * `isTester` con criterios que se van despegando entre página y página.
 */
export async function sectionFeatures(
  userId: string
): Promise<Partial<Record<FeatureFlag, boolean>>> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { isTester: true },
  });
  const isTester = profile?.isTester ?? false;
  return { gastosHormiga: hasFeature("gastosHormiga", { isTester }) };
}
