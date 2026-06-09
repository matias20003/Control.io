import { prisma } from "@/lib/prisma";

/** Guarda un reporte de feedback de un tester. */
export async function createFeedback(input: {
  userId?: string | null;
  email?: string | null;
  message: string;
  page?: string | null;
}) {
  return prisma.feedback.create({
    data: {
      userId: input.userId ?? null,
      email: input.email ?? null,
      message: input.message,
      page: input.page ?? null,
    },
  });
}
