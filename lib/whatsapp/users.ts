import { prisma } from "@/lib/prisma";

/**
 * Busca el perfil cuyo número de WhatsApp coincida con el teléfono entrante.
 * Compara por los últimos 10 dígitos para tolerar el "+", el "9" de Argentina
 * y los espacios/guiones.
 */
export async function findProfileByPhone(phone: string): Promise<{ id: string } | null> {
  const digits = phone.replace(/\D/g, "");
  const tail = digits.slice(-10);
  if (tail.length < 8) return null;

  const profiles = await prisma.profile.findMany({
    where: { whatsappNumber: { not: null } },
    select: { id: true, whatsappNumber: true },
  });

  for (const p of profiles) {
    const pd = (p.whatsappNumber ?? "").replace(/\D/g, "");
    if (pd && (pd.slice(-10) === tail || pd.endsWith(tail) || digits.endsWith(pd.slice(-10)))) {
      return { id: p.id };
    }
  }
  return null;
}
