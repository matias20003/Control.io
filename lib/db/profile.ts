import { prisma } from "@/lib/prisma";

const DEFAULT_CATEGORIES = [
  // Gastos
  { name: "Comida y bebida",  icon: "🍕", color: "#ef4444", type: "EXPENSE" as const },
  { name: "Transporte",       icon: "🚗", color: "#f59e0b", type: "EXPENSE" as const },
  { name: "Hogar",            icon: "🏠", color: "#8b5cf6", type: "EXPENSE" as const },
  { name: "Salud",            icon: "💊", color: "#22c55e", type: "EXPENSE" as const },
  { name: "Entretenimiento",  icon: "🎬", color: "#ec4899", type: "EXPENSE" as const },
  { name: "Ropa",             icon: "👗", color: "#06b6d4", type: "EXPENSE" as const },
  { name: "Educación",        icon: "📚", color: "#3b82f6", type: "EXPENSE" as const },
  { name: "Tecnología",       icon: "💻", color: "#6366f1", type: "EXPENSE" as const },
  { name: "Viajes",           icon: "✈️", color: "#0ea5e9", type: "EXPENSE" as const },
  { name: "Mascotas",         icon: "🐾", color: "#a78bfa", type: "EXPENSE" as const },
  { name: "Otros gastos",     icon: "📦", color: "#94a3b8", type: "EXPENSE" as const },
  // Ingresos
  { name: "Sueldo",           icon: "💼", color: "#22c55e", type: "INCOME" as const },
  { name: "Freelance",        icon: "🧑‍💻", color: "#38bdf8", type: "INCOME" as const },
  { name: "Regalo",           icon: "🎁", color: "#f59e0b", type: "INCOME" as const },
  { name: "Inversiones",      icon: "📈", color: "#818cf8", type: "INCOME" as const },
  { name: "Otros ingresos",   icon: "💰", color: "#94a3b8", type: "INCOME" as const },
];

export async function getOrCreateProfile(userId: string, email: string, name?: string) {
  const existing = await prisma.profile.findUnique({ where: { id: userId } });
  if (existing) return existing;

  const profile = await prisma.profile.create({
    data: {
      id: userId,
      email,
      name: name || email.split("@")[0],
    },
  });

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((cat) => ({ ...cat, userId })),
    skipDuplicates: true,
  });

  // Cuentas por defecto
  await prisma.account.createMany({
    data: [
      { userId, name: "Efectivo", type: "CASH", currency: "ARS", balance: 0, icon: "💵", color: "#22c55e" },
      { userId, name: "Cuenta bancaria", type: "BANK", currency: "ARS", balance: 0, icon: "🏦", color: "#3b82f6" },
      { userId, name: "Mercado Pago", type: "DIGITAL_WALLET", currency: "ARS", balance: 0, icon: "💙", color: "#06b6d4" },
    ],
    skipDuplicates: true,
  });

  return profile;
}

/** Normaliza un número de WhatsApp a solo dígitos (con código de país). */
export function normalizeWhatsapp(input: string): string {
  return input.replace(/\D/g, "");
}

export async function getProfileWhatsapp(userId: string): Promise<string | null> {
  const p = await prisma.profile.findUnique({
    where: { id: userId },
    select: { whatsappNumber: true },
  });
  return p?.whatsappNumber ?? null;
}

/**
 * Vincula (o desvincula con null) el número de WhatsApp del usuario.
 * Lanza error con code "P2002" si el número ya está en uso por otra cuenta.
 */
export async function setWhatsappNumber(
  userId: string,
  email: string,
  name: string | undefined,
  number: string | null
): Promise<string | null> {
  await getOrCreateProfile(userId, email, name);
  const value = number ? normalizeWhatsapp(number) : null;
  const updated = await prisma.profile.update({
    where: { id: userId },
    data: { whatsappNumber: value },
    select: { whatsappNumber: true },
  });
  return updated.whatsappNumber;
}
