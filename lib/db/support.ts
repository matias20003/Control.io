import "server-only";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/alerts";

export type TicketDTO = {
  id: string;
  fromName: string | null;
  fromContact: string | null;
  motivo: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

/**
 * Un usuario escaló una duda que el bot no pudo resolver: crea el TICKET y
 * avisa al admin. Evita duplicados si el mismo usuario ya abrió uno hace <2 min.
 */
export async function escalateSupport(userId: string, motivo: string): Promise<void> {
  const clean = (motivo || "consulta de soporte").slice(0, 600);
  const prof = await prisma.profile.findFirst({
    where: { id: userId },
    select: { name: true, whatsappNumber: true, email: true },
  });
  const who = prof?.name || prof?.whatsappNumber || prof?.email || userId.slice(0, 8);

  // Anti-duplicado: si ya tiene un ticket abierto reciente, no creamos otro.
  const recent = await prisma.supportTicket.findFirst({
    where: { userId, status: "abierto", createdAt: { gte: new Date(Date.now() - 2 * 60_000) } },
    select: { id: true },
  });
  if (!recent) {
    await prisma.supportTicket.create({
      data: {
        userId,
        fromName: prof?.name ?? null,
        fromContact: prof?.whatsappNumber ?? prof?.email ?? null,
        motivo: clean,
        status: "abierto",
      },
    });
  }
  await notifyAdmin("🆘 Soporte — un usuario necesita ayuda", `${who}: ${clean.slice(0, 400)}`).catch(() => {});
}

export async function listSupportTickets(limit = 60): Promise<TicketDTO[]> {
  const rows = await prisma.supportTicket.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map((t) => ({
    id: t.id,
    fromName: t.fromName,
    fromContact: t.fromContact,
    motivo: t.motivo,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
  }));
}

export async function countOpenTickets(): Promise<number> {
  return prisma.supportTicket.count({ where: { status: "abierto" } });
}

export async function setTicketStatus(id: string, resolved: boolean): Promise<void> {
  await prisma.supportTicket.update({
    where: { id },
    data: { status: resolved ? "resuelto" : "abierto", resolvedAt: resolved ? new Date() : null },
  });
}
