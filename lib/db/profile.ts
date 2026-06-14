import { prisma } from "@/lib/prisma";

export const DEFAULT_CATEGORIES = [
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

/** Claves "TYPE:nombre" de las categorías sembradas por defecto.
 *  Sirve para detectar si el usuario agregó categorías propias (onboarding),
 *  de forma robusta: cualquier categoría con nombre/tipo distinto a las
 *  default cuenta como propia (aunque haya borrado alguna default). */
export const DEFAULT_CATEGORY_KEYS = new Set(
  DEFAULT_CATEGORIES.map((c) => `${c.type}:${c.name}`)
);

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

export type ReportPrefs = {
  enabled: boolean;
  /** 0=Domingo … 6=Sábado (JS getDay). null si nunca se configuró. */
  day: number | null;
  /** 0–23, hora Argentina. null si nunca se configuró. */
  hour: number | null;
};

/** Preferencia de reporte semanal por email del usuario. */
export async function getReportPrefs(userId: string): Promise<ReportPrefs> {
  const p = await prisma.profile.findUnique({
    where: { id: userId },
    select: { weeklyReportEnabled: true, weeklyReportDay: true, weeklyReportHour: true },
  });
  return {
    enabled: p?.weeklyReportEnabled ?? false,
    day: p?.weeklyReportDay ?? null,
    hour: p?.weeklyReportHour ?? null,
  };
}

/** Lee si el recordatorio diario por WhatsApp está activo. */
export async function getDailyReminderPref(userId: string): Promise<boolean> {
  const p = await prisma.profile.findUnique({
    where: { id: userId },
    select: { dailyReminderEnabled: true },
  });
  return p?.dailyReminderEnabled ?? false;
}

/** Activa o desactiva el recordatorio diario por WhatsApp. */
export async function setDailyReminderPref(
  userId: string,
  email: string,
  name: string | undefined,
  enabled: boolean,
): Promise<boolean> {
  await getOrCreateProfile(userId, email, name);
  const updated = await prisma.profile.update({
    where: { id: userId },
    data: { dailyReminderEnabled: enabled },
    select: { dailyReminderEnabled: true },
  });
  return updated.dailyReminderEnabled;
}

/** Usuarios con recordatorio diario activo y número de WhatsApp vinculado. */
export async function getDailyReminderRecipients(): Promise<{ id: string; whatsappNumber: string | null }[]> {
  // Todos los que activaron el recordatorio. El canal se decide al enviar:
  // WhatsApp si está vinculado, y si no se puede, notificación push.
  return prisma.profile.findMany({
    where: { dailyReminderEnabled: true },
    select: { id: true, whatsappNumber: true },
  });
}

/** Actualiza la preferencia de reporte semanal. Valida rangos (day 0–6, hour 0–23). */
export async function updateReportPrefs(
  userId: string,
  email: string,
  name: string | undefined,
  prefs: ReportPrefs
): Promise<ReportPrefs> {
  await getOrCreateProfile(userId, email, name);

  const day =
    prefs.day == null ? null : Math.min(6, Math.max(0, Math.trunc(prefs.day)));
  const hour =
    prefs.hour == null ? null : Math.min(23, Math.max(0, Math.trunc(prefs.hour)));

  const updated = await prisma.profile.update({
    where: { id: userId },
    data: {
      weeklyReportEnabled: prefs.enabled,
      weeklyReportDay: day,
      weeklyReportHour: hour,
    },
    select: { weeklyReportEnabled: true, weeklyReportDay: true, weeklyReportHour: true },
  });
  return {
    enabled: updated.weeklyReportEnabled,
    day: updated.weeklyReportDay,
    hour: updated.weeklyReportHour,
  };
}
