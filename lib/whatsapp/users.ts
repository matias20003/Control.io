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
    // Coincidencia ESTRICTA por los últimos 10 dígitos (área + abonado en AR),
    // robusta al "+54 9" y a los formatos con/sin código de país. Antes el OR
    // con endsWith en ambos sentidos podía cruzar dos números parecidos y
    // atribuirle un mensaje al usuario equivocado.
    if (pd.length >= 10 && pd.slice(-10) === tail) {
      return { id: p.id };
    }
  }
  return null;
}
