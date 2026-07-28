import { prisma } from "@/lib/prisma";
import type { DiscoveryLevel } from "@/lib/brief/types";

export type RadarGenerationResult = {
  created: number;
  reason: "DISABLED" | "INSUFFICIENT_SIGNALS" | "READY";
};

/**
 * Punto de extensión honesto para Radar. Sin un catálogo autorizado de cuentas
 * candidatas no inventa nombres, popularidad ni métricas. Los adaptadores
 * futuros pueden crear DiscoveryCandidate y esta función conservará el mismo
 * contrato para el orquestador.
 */
export async function generateRadarForUser(
  userId: string,
  level: DiscoveryLevel
): Promise<RadarGenerationResult> {
  if (level === "CONSERVATIVE") {
    return { created: 0, reason: "DISABLED" };
  }

  const availableSignals = await prisma.socialPost.count({
    where: {
      account: {
        source: { userId, isActive: true },
      },
      publishedAt: {
        gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
    },
  });
  if (availableSignals < 3) {
    return { created: 0, reason: "INSUFFICIENT_SIGNALS" };
  }

  // Todavía no existe un catálogo externo autorizado contra el cual comparar.
  // Tener señales propias no alcanza para recomendar cuentas nuevas.
  return { created: 0, reason: "INSUFFICIENT_SIGNALS" };
}
