import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

export type OrganizationTask = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: string;
  priority: string;
  urgent: boolean;
  important: boolean;
  listId: string | null;
  someday: boolean;
  order: number;
  recurrenceRule: string | null;
  reminderMinutes: number | null;
  source: string;
  syncStatus: string;
  syncError: string | null;
  done: boolean;
};

type TaskRow = {
  id: string; title: string; description: string | null; dueDate: Date | null;
  scheduledStart: Date | null; scheduledEnd: Date | null; status: string;
  priority: string; urgent: boolean; important: boolean; listId: string | null;
  someday: boolean; order: number; recurrenceRule: string | null; reminderMinutes: number | null;
  source: string; syncStatus: string; syncError: string | null; done: boolean;
};

function text(value: string | null): string | null {
  return value ? (decrypt(value) ?? value) : null;
}

export function serializeOrganizationTask(row: TaskRow): OrganizationTask {
  return {
    ...row,
    title: text(row.title) ?? row.title,
    description: text(row.description),
    dueDate: row.dueDate?.toISOString() ?? null,
    scheduledStart: row.scheduledStart?.toISOString() ?? null,
    scheduledEnd: row.scheduledEnd?.toISOString() ?? null,
  };
}

export async function getOrganization(userId: string) {
  const [tasks, lists, habits] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      orderBy: [{ done: "asc" }, { order: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
      take: 1000,
    }),
    prisma.organizationList.findMany({ where: { userId }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    prisma.habit.findMany({
      where: { userId, isActive: true },
      include: { completions: { orderBy: { date: "desc" }, take: 90 } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return {
    tasks: tasks.map(serializeOrganizationTask),
    lists: lists.map((list) => ({ ...list, createdAt: list.createdAt.toISOString(), updatedAt: list.updatedAt.toISOString() })),
    habits: habits.map((habit) => ({
      ...habit,
      name: text(habit.name) ?? habit.name,
      createdAt: habit.createdAt.toISOString(),
      updatedAt: habit.updatedAt.toISOString(),
      completions: habit.completions.map((completion) => ({
        id: completion.id,
        date: completion.date.toISOString().slice(0, 10),
      })),
    })),
  };
}

export type OrganizationTaskInput = {
  title: string;
  description?: string | null;
  dueDate?: Date | null;
  scheduledStart?: Date | null;
  scheduledEnd?: Date | null;
  status?: string;
  priority?: string;
  urgent?: boolean;
  important?: boolean;
  listId?: string | null;
  someday?: boolean;
  recurrenceRule?: string | null;
  reminderMinutes?: number | null;
};

export async function createOrganizationTask(userId: string, input: OrganizationTaskInput) {
  if (input.listId) {
    const list = await prisma.organizationList.findFirst({ where: { id: input.listId, userId }, select: { id: true } });
    if (!list) throw new Error("Lista inválida");
  }
  const row = await prisma.task.create({
    data: {
      userId,
      title: encrypt(input.title) ?? input.title,
      description: input.description ? (encrypt(input.description) ?? input.description) : null,
      // NO se autocompleta con scheduledStart: "cuando lo hago" y "cuando
      // vence" son cosas distintas, y fusionarlas hacia que Hoy mostrara todo
      // lo que tuviera fecha en vez de lo que decidiste hacer hoy.
      dueDate: input.dueDate ?? null,
      scheduledStart: input.scheduledStart ?? null,
      scheduledEnd: input.scheduledEnd ?? null,
      status: input.status ?? "TODO",
      priority: input.priority ?? "NONE",
      urgent: input.urgent ?? false,
      important: input.important ?? false,
      listId: input.listId ?? null,
      someday: input.someday ?? false,
      recurrenceRule: input.recurrenceRule ?? null,
      reminderMinutes: input.reminderMinutes ?? null,
      syncStatus: input.scheduledStart ? "PENDING" : "LOCAL",
    },
  });
  return serializeOrganizationTask(row);
}

export async function updateOrganizationTask(userId: string, id: string, input: Partial<OrganizationTaskInput> & { order?: number }) {
  const current = await prisma.task.findFirst({ where: { id, userId }, select: { id: true, done: true } });
  if (!current) throw new Error("Tarea no encontrada");
  if (input.listId) {
    const list = await prisma.organizationList.findFirst({ where: { id: input.listId, userId }, select: { id: true } });
    if (!list) throw new Error("Lista inválida");
  }
  const done = input.status === "DONE" ? true : input.status ? false : undefined;
  const row = await prisma.task.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: encrypt(input.title) ?? input.title } : {}),
      ...(input.description !== undefined ? { description: input.description ? (encrypt(input.description) ?? input.description) : null } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(input.scheduledStart !== undefined ? { scheduledStart: input.scheduledStart, syncStatus: "PENDING" } : {}),
      ...(input.scheduledEnd !== undefined ? { scheduledEnd: input.scheduledEnd, syncStatus: "PENDING" } : {}),
      ...(input.status !== undefined ? { status: input.status, done, doneAt: done ? new Date() : null } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.urgent !== undefined ? { urgent: input.urgent } : {}),
      ...(input.important !== undefined ? { important: input.important } : {}),
      ...(input.listId !== undefined ? { listId: input.listId } : {}),
      ...(input.someday !== undefined ? { someday: input.someday } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      ...(input.recurrenceRule !== undefined ? { recurrenceRule: input.recurrenceRule } : {}),
      ...(input.reminderMinutes !== undefined ? { reminderMinutes: input.reminderMinutes } : {}),
    },
  });
  return serializeOrganizationTask(row);
}

/** Borra la tarea. Devuelve los datos de Google para poder limpiar el evento. */
export async function deleteOrganizationTask(userId: string, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, userId },
    select: { id: true, googleEventId: true, googleCalendarId: true },
  });
  if (!task) throw new Error("Tarea no encontrada");
  await prisma.task.delete({ where: { id } });
  return { googleEventId: task.googleEventId, googleCalendarId: task.googleCalendarId };
}

// ── Listas ───────────────────────────────────────────────────
// El Inbox no es una fila: son las tareas con listId = null. La FK de Task es
// onDelete: SetNull, así que al borrar una lista sus tareas caen solas ahí.

export async function createOrganizationList(userId: string, name: string, color = "#2563eb", icon?: string | null) {
  const position = await prisma.organizationList.count({ where: { userId } });
  return prisma.organizationList.create({ data: { userId, name, color, icon: icon ?? null, position } });
}

export async function updateOrganizationList(
  userId: string,
  id: string,
  input: { name?: string; color?: string; icon?: string | null },
) {
  const list = await prisma.organizationList.findFirst({ where: { id, userId }, select: { id: true } });
  if (!list) throw new Error("Lista no encontrada");
  return prisma.organizationList.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
    },
  });
}

/** Borra la lista. Sus tareas no se pierden: quedan en el Inbox. */
export async function deleteOrganizationList(userId: string, id: string) {
  const list = await prisma.organizationList.findFirst({ where: { id, userId }, select: { id: true } });
  if (!list) throw new Error("Lista no encontrada");
  const moved = await prisma.task.count({ where: { userId, listId: id } });
  await prisma.organizationList.delete({ where: { id } });
  return { movedToInbox: moved };
}

/** Reordena las listas según el orden de los ids recibidos. */
export async function reorderOrganizationLists(userId: string, ids: string[]) {
  const owned = await prisma.organizationList.findMany({ where: { userId, id: { in: ids } }, select: { id: true } });
  const valid = new Set(owned.map((list) => list.id));
  await prisma.$transaction(
    ids
      .filter((id) => valid.has(id))
      .map((id, position) => prisma.organizationList.update({ where: { id }, data: { position } })),
  );
}

export async function createHabit(userId: string, input: {
  name: string; icon?: string | null; color?: string; frequency?: string;
  daysOfWeek?: number[]; targetPerPeriod?: number; scheduledTime?: string | null;
}) {
  return prisma.habit.create({
    data: {
      userId,
      name: encrypt(input.name) ?? input.name,
      icon: input.icon,
      color: input.color ?? "#2563eb",
      frequency: input.frequency ?? "DAILY",
      daysOfWeek: input.daysOfWeek ?? [],
      targetPerPeriod: input.targetPerPeriod ?? 1,
      scheduledTime: input.scheduledTime,
    },
  });
}

export async function updateHabit(userId: string, id: string, input: {
  name?: string; icon?: string | null; color?: string; frequency?: string;
  daysOfWeek?: number[]; targetPerPeriod?: number; scheduledTime?: string | null;
}) {
  const habit = await prisma.habit.findFirst({ where: { id, userId }, select: { id: true } });
  if (!habit) throw new Error("Hábito no encontrado");
  return prisma.habit.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: encrypt(input.name) ?? input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
      ...(input.daysOfWeek !== undefined ? { daysOfWeek: input.daysOfWeek } : {}),
      ...(input.targetPerPeriod !== undefined ? { targetPerPeriod: input.targetPerPeriod } : {}),
      ...(input.scheduledTime !== undefined ? { scheduledTime: input.scheduledTime } : {}),
    },
  });
}

/** Borra el hábito y todo su historial. Irreversible. */
export async function deleteHabit(userId: string, id: string) {
  const habit = await prisma.habit.findFirst({ where: { id, userId }, select: { id: true } });
  if (!habit) throw new Error("Hábito no encontrado");
  await prisma.habit.delete({ where: { id } });
}

export async function toggleHabitCompletion(userId: string, habitId: string, date: Date) {
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId }, select: { id: true } });
  if (!habit) throw new Error("Hábito no encontrado");
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const existing = await prisma.habitCompletion.findUnique({ where: { habitId_date: { habitId, date: normalized } } });
  if (existing) {
    await prisma.habitCompletion.delete({ where: { id: existing.id } });
    return false;
  }
  await prisma.habitCompletion.create({ data: { habitId, date: normalized } });
  return true;
}
