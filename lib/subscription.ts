import { prisma } from "@/lib/prisma";

// Precio de arranque (ARS). Centralizado para mostrarlo en el paywall y crear
// la suscripción en MercadoPago con el mismo valor.
export const PREMIUM_PRICE_ARS = 4000;
export const PREMIUM_PRICE_YEARLY_ARS = 40000; // 2 meses gratis

/**
 * Acceso premium: lo decide `premiumUntil` (fecha hasta la que está pago), que
 * renueva/corta el webhook de MercadoPago. Si venció, cae a free solo.
 * Fuente de verdad única — toda feature paga la consulta con esto.
 */
export async function isPremium(userId: string): Promise<boolean> {
  const p = await prisma.profile.findUnique({
    where: { id: userId },
    select: { premiumUntil: true },
  });
  return !!p?.premiumUntil && p.premiumUntil.getTime() > Date.now();
}

export type PremiumStatus = {
  isPremium: boolean;
  premiumUntil: Date | null;
  plan: string;
};

export async function getPremiumStatus(userId: string): Promise<PremiumStatus> {
  const p = await prisma.profile.findUnique({
    where: { id: userId },
    select: { plan: true, premiumUntil: true },
  });
  const active = !!p?.premiumUntil && p.premiumUntil.getTime() > Date.now();
  return { isPremium: active, premiumUntil: p?.premiumUntil ?? null, plan: p?.plan ?? "free" };
}

// Qué incluye Premium (para mostrar en el paywall y mantener una sola lista).
export const PREMIUM_FEATURES = [
  { icon: "🤖", title: "Asesor por WhatsApp", desc: "Cargá por texto, audio o foto y recibí consejos." },
  { icon: "🔮", title: "¿Llego a fin de mes?", desc: "Proyección de tu saldo y aviso si te vas a quedar corto." },
  { icon: "🐜", title: "Detector de gastos hormiga", desc: "Encontramos suscripciones y plata que se te escapa." },
  { icon: "✅", title: "Tareas financieras inteligentes", desc: "Tu checklist de plata de la semana, armado solo." },
] as const;
