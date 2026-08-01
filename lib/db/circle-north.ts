/**
 * Mi Círculo · El Norte — acceso a datos de los frentes.
 *
 * La etiqueta y el detalle son lo que la persona quiere ser: se guardan
 * cifrados, igual que los nombres de hábitos. Los temas van en claro porque son
 * términos de búsqueda, no datos personales.
 */

import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { MAX_FRONTS, type NorthFront } from "@/lib/circle-north";

export type SerializedFront = NorthFront & {
  reviewedAt: string | null;
  createdAt: string;
};

type FrontRow = {
  id: string;
  label: string;
  detail: string | null;
  topics: string[];
  position: number;
  reviewedAt: Date | null;
  createdAt: Date;
};

function text(value: string | null): string | null {
  return value ? (decrypt(value) ?? value) : null;
}

function serialize(row: FrontRow): SerializedFront {
  return {
    id: row.id,
    label: text(row.label) ?? row.label,
    detail: text(row.detail),
    topics: row.topics,
    position: row.position,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const FIELDS = {
  id: true,
  label: true,
  detail: true,
  topics: true,
  position: true,
  reviewedAt: true,
  createdAt: true,
} as const;

export async function getFronts(userId: string): Promise<SerializedFront[]> {
  const rows = await prisma.circleFront.findMany({
    where: { userId, isActive: true },
    select: FIELDS,
    orderBy: { position: "asc" },
  });
  return rows.map(serialize);
}

export async function createFront(
  userId: string,
  input: { label: string; detail?: string | null; topics: string[] },
): Promise<SerializedFront> {
  const count = await prisma.circleFront.count({ where: { userId, isActive: true } });
  if (count >= MAX_FRONTS) {
    throw new Error(
      `Tres frentes es el máximo. Más frentes es no tener ninguno — sacá uno antes de sumar otro.`,
    );
  }
  const row = await prisma.circleFront.create({
    data: {
      userId,
      label: encrypt(input.label) ?? input.label,
      detail: encrypt(input.detail ?? null),
      topics: input.topics,
      position: count,
    },
    select: FIELDS,
  });
  return serialize(row);
}

export async function updateFront(
  userId: string,
  id: string,
  input: { label?: string; detail?: string | null; topics?: string[]; position?: number },
): Promise<SerializedFront> {
  await assertOwned(userId, id);
  const row = await prisma.circleFront.update({
    where: { id },
    data: {
      ...(input.label !== undefined ? { label: encrypt(input.label) ?? input.label } : {}),
      ...(input.detail !== undefined ? { detail: encrypt(input.detail) } : {}),
      ...(input.topics !== undefined ? { topics: input.topics } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
    },
    select: FIELDS,
  });
  return serialize(row);
}

export async function deleteFront(userId: string, id: string): Promise<void> {
  await assertOwned(userId, id);
  await prisma.circleFront.update({ where: { id }, data: { isActive: false } });
}

/** Reordena: el frente en la posición 0 es el que manda sobre los prioritarios. */
export async function reorderFronts(userId: string, ids: string[]): Promise<void> {
  const owned = await prisma.circleFront.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true },
  });
  const valid = new Set(owned.map((front) => front.id));
  await prisma.$transaction(
    ids
      .filter((id) => valid.has(id))
      .map((id, position) => prisma.circleFront.update({ where: { id }, data: { position } })),
  );
}

/** Deja constancia de que el usuario revisó su Norte hoy. */
export async function markNorthReviewed(userId: string): Promise<void> {
  await prisma.circleFront.updateMany({
    where: { userId, isActive: true },
    data: { reviewedAt: new Date() },
  });
}

async function assertOwned(userId: string, id: string): Promise<void> {
  const found = await prisma.circleFront.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!found) throw new Error("Frente no encontrado");
}
