import { prisma } from "@/lib/prisma";

export type SerializedCategory = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: string;
  parentId: string | null;
};

function serialize(c: any): SerializedCategory {
  return { id: c.id, name: c.name, icon: c.icon, color: c.color, type: c.type, parentId: c.parentId };
}

export async function getCategories(userId: string): Promise<SerializedCategory[]> {
  const rows = await prisma.category.findMany({
    where: { userId, isActive: true, parentId: null },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return rows.map(serialize);
}

export async function createCategory(userId: string, data: {
  name: string; icon?: string; color?: string; type: "INCOME" | "EXPENSE";
}) {
  const row = await prisma.category.create({
    data: { userId, name: data.name, icon: data.icon ?? null, color: data.color ?? null, type: data.type as any },
  });
  return serialize(row);
}

export async function updateCategory(userId: string, categoryId: string, data: {
  name?: string; icon?: string; color?: string;
}) {
  const row = await prisma.category.update({
    where: { id: categoryId, userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.color !== undefined && { color: data.color }),
    },
  });
  return serialize(row);
}

export async function deleteCategory(userId: string, categoryId: string) {
  await prisma.category.update({
    where: { id: categoryId, userId },
    data: { isActive: false },
  });
}
