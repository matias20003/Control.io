/**
 * Mi Círculo · Cercanos — acceso a datos.
 *
 * Nombre, teléfono y nota son datos personales de terceros: se guardan cifrados
 * y se descifran sólo al serializar para el cliente, igual que los hábitos.
 */

import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { cadenceState, type CadenceState } from "@/lib/circle-cadence";

export type CircleContact = {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  tier: string;
  cadenceDays: number;
  lastContactAt: string | null;
  createdAt: string;
} & CadenceState;

type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  tier: string;
  cadenceDays: number;
  lastContactAt: Date | null;
  createdAt: Date;
};

function text(value: string | null): string | null {
  return value ? (decrypt(value) ?? value) : null;
}

export function serializeCircleContact(row: ContactRow, today: Date): CircleContact {
  return {
    id: row.id,
    name: text(row.name) ?? row.name,
    phone: text(row.phone),
    note: text(row.note),
    tier: row.tier,
    cadenceDays: row.cadenceDays,
    lastContactAt: row.lastContactAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    ...cadenceState(row, today),
  };
}

const CONTACT_FIELDS = {
  id: true,
  name: true,
  phone: true,
  note: true,
  tier: true,
  cadenceDays: true,
  lastContactAt: true,
  createdAt: true,
} as const;

export async function getCircleContacts(userId: string, today = new Date()): Promise<CircleContact[]> {
  const rows = await prisma.circleContact.findMany({
    where: { userId, isActive: true },
    select: CONTACT_FIELDS,
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return rows.map((row) => serializeCircleContact(row, today));
}

export type CircleContactInput = {
  name: string;
  phone?: string | null;
  note?: string | null;
  cadenceDays: number;
  tier: string;
  lastContactAt?: Date | null;
};

export async function createCircleContact(
  userId: string,
  input: CircleContactInput,
  today = new Date(),
): Promise<CircleContact> {
  const row = await prisma.circleContact.create({
    data: {
      userId,
      name: encrypt(input.name) ?? input.name,
      phone: encrypt(input.phone ?? null),
      note: encrypt(input.note ?? null),
      cadenceDays: input.cadenceDays,
      tier: input.tier,
      lastContactAt: input.lastContactAt ?? null,
    },
    select: CONTACT_FIELDS,
  });
  return serializeCircleContact(row, today);
}

export async function updateCircleContact(
  userId: string,
  id: string,
  input: Partial<CircleContactInput>,
  today = new Date(),
): Promise<CircleContact> {
  await assertOwned(userId, id);
  const row = await prisma.circleContact.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: encrypt(input.name) ?? input.name } : {}),
      ...(input.phone !== undefined ? { phone: encrypt(input.phone) } : {}),
      ...(input.note !== undefined ? { note: encrypt(input.note) } : {}),
      ...(input.cadenceDays !== undefined ? { cadenceDays: input.cadenceDays } : {}),
      ...(input.tier !== undefined ? { tier: input.tier } : {}),
      ...(input.lastContactAt !== undefined ? { lastContactAt: input.lastContactAt } : {}),
    },
    select: CONTACT_FIELDS,
  });
  return serializeCircleContact(row, today);
}

/**
 * Sale del círculo pero no se borra el historial: `isActive = false`. Sacar a
 * alguien de la lista no debería sentirse como borrar a una persona.
 */
export async function archiveCircleContact(userId: string, id: string): Promise<void> {
  await assertOwned(userId, id);
  await prisma.circleContact.update({ where: { id }, data: { isActive: false } });
}

/**
 * El usuario declara que habló con alguien. Control.io no ve sus conversaciones
 * con terceros, así que este es el único origen posible del dato.
 *
 * `note` es lo que salió de esa charla, en sus palabras. Es opcional a
 * propósito: registrar la conversación nunca puede quedar bloqueado por no
 * querer contar de qué hablaron.
 */
export async function recordCircleTouch(
  userId: string,
  id: string,
  happenedAt = new Date(),
  source: "APP" | "WHATSAPP" = "APP",
  today = new Date(),
  note: string | null = null,
): Promise<CircleContact> {
  await assertOwned(userId, id);
  const [, row] = await prisma.$transaction([
    prisma.circleTouch.create({
      data: { contactId: id, userId, happenedAt, source, note: encrypt(note) },
    }),
    prisma.circleContact.update({
      where: { id },
      data: { lastContactAt: happenedAt },
      select: CONTACT_FIELDS,
    }),
  ]);
  return serializeCircleContact(row, today);
}

/**
 * Anota qué salió de la última conversación con esta persona. Va separado del
 * registro porque se pregunta después — primero se declara que hablaron, y
 * recién ahí, sin obligación, qué pasó.
 */
export async function annotateLastTouch(
  userId: string,
  contactId: string,
  note: string,
): Promise<void> {
  await assertOwned(userId, contactId);
  const last = await prisma.circleTouch.findFirst({
    where: { userId, contactId },
    orderBy: { happenedAt: "desc" },
    select: { id: true },
  });
  if (!last) return;
  await prisma.circleTouch.update({
    where: { id: last.id },
    data: { note: encrypt(note) },
  });
}

/** Conversaciones declaradas desde `since`. Es la métrica que reemplaza al tiempo de pantalla. */
export async function countCircleTouches(userId: string, since: Date): Promise<number> {
  return prisma.circleTouch.count({ where: { userId, happenedAt: { gte: since } } });
}

/**
 * Los números del espejo: cuántas conversaciones ocurrieron y cuántas dejaron
 * algo escrito. La segunda es la que convierte un contador en un recuerdo.
 */
export async function getTouchStats(
  userId: string,
): Promise<{ total: number; withMemory: number }> {
  const [total, withMemory] = await Promise.all([
    prisma.circleTouch.count({ where: { userId } }),
    prisma.circleTouch.count({ where: { userId, note: { not: null } } }),
  ]);
  return { total, withMemory };
}

async function assertOwned(userId: string, id: string): Promise<void> {
  const found = await prisma.circleContact.findFirst({ where: { id, userId }, select: { id: true } });
  if (!found) throw new Error("Contacto no encontrado");
}
