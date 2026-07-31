import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

export type SerializedTask = {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  createdAt: string;
};

function serialize(t: {
  id: string;
  title: string;
  dueDate: Date | null;
  done: boolean;
  createdAt: Date;
}): SerializedTask {
  return {
    id: t.id,
    title: decrypt(t.title) ?? t.title,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    done: t.done,
    createdAt: t.createdAt.toISOString(),
  };
}

export async function getTasks(userId: string): Promise<SerializedTask[]> {
  const rows = await prisma.task.findMany({
    where: { userId },
    orderBy: [{ done: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
  });
  return rows.map(serialize);
}

export async function createTask(
  userId: string,
  data: { title: string; dueDate?: Date | null }
): Promise<SerializedTask> {
  const row = await prisma.task.create({
    data: { userId, title: encrypt(data.title) ?? data.title, dueDate: data.dueDate ?? null },
  });
  return serialize(row);
}

/** Edita el título y/o la fecha (moverla de día). Verifica ownership. */
export async function updateTask(
  userId: string,
  id: string,
  data: { title?: string; dueDate?: Date | null }
): Promise<void> {
  const t = await prisma.task.findFirst({ where: { id, userId }, select: { id: true } });
  if (!t) throw new Error("No encontrada");
  const patch: { title?: string; dueDate?: Date | null } = {};
  if (data.title !== undefined) patch.title = encrypt(data.title) ?? data.title;
  if (data.dueDate !== undefined) patch.dueDate = data.dueDate;
  await prisma.task.update({ where: { id }, data: patch });
}

/** Marca/desmarca como hecha. Verifica ownership con el where compuesto. */
export async function toggleTask(userId: string, id: string): Promise<void> {
  const t = await prisma.task.findFirst({ where: { id, userId }, select: { done: true } });
  if (!t) throw new Error("No encontrada");
  await prisma.task.update({
    where: { id },
    data: { done: !t.done, status: !t.done ? "DONE" : "TODO", doneAt: !t.done ? new Date() : null },
  });
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  await prisma.task.deleteMany({ where: { id, userId } });
}
