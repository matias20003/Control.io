import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { differenceInDays, isAfter, isBefore, startOfDay } from "date-fns";
import { sendPushToUser } from "@/lib/push/send";

// Vercel Cron: diariamente a las 11:00 UTC (08:00 ARG)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

function shouldExecuteToday(
  r: {
    frequency: string;
    dayOfMonth: number | null;
    startDate: Date;
    endDate: Date | null;
    lastExecuted: Date | null;
  },
  today: Date
): boolean {
  if (r.endDate && isBefore(r.endDate, today)) return false;
  if (isAfter(r.startDate, today)) return false;

  if (!r.lastExecuted) return true; // nunca ejecutado

  const daysSinceLast = differenceInDays(today, r.lastExecuted);

  switch (r.frequency) {
    case "DAILY":
      return daysSinceLast >= 1;
    case "WEEKLY":
      return daysSinceLast >= 7;
    case "BIWEEKLY":
      return daysSinceLast >= 14;
    case "MONTHLY": {
      const targetDay = r.dayOfMonth ?? r.lastExecuted.getDate();
      const sameDay = today.getDate() === targetDay;
      const differentMonth =
        today.getMonth() !== r.lastExecuted.getMonth() ||
        today.getFullYear() !== r.lastExecuted.getFullYear();
      return sameDay && differentMonth;
    }
    case "QUARTERLY":
      return daysSinceLast >= 90;
    case "YEARLY":
      return daysSinceLast >= 365;
    default:
      return false;
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = startOfDay(new Date());

  const recurrentes = await prisma.recurringTransaction.findMany({
    where: { isActive: true },
    include: { user: { select: { id: true, email: true } } },
  });

  let executed = 0;
  let skipped = 0;

  for (const r of recurrentes) {
    if (!shouldExecuteToday(r, today)) {
      skipped++;
      continue;
    }

    try {
      // Crear transacción automática
      await prisma.transaction.create({
        data: {
          userId: r.userId,
          type: r.type,
          amount: r.amount,
          currency: r.currency,
          description: r.description,
          date: today,
          categoryId: r.categoryId ?? null,
          notes: "✅ Ejecutado automáticamente",
        },
      });

      // Actualizar lastExecuted
      await prisma.recurringTransaction.update({
        where: { id: r.id },
        data: { lastExecuted: today },
      });

      // Enviar push notification
      await sendPushToUser(r.userId, {
        title: "Movimiento recurrente registrado",
        body: `${r.type === "INCOME" ? "💚" : "🔴"} ${r.description} — ${new Intl.NumberFormat("es-AR", { style: "currency", currency: r.currency, minimumFractionDigits: 0 }).format(parseFloat(String(r.amount)))}`,
        url: "/movimientos",
      }).catch(() => {});

      executed++;
    } catch (err) {
      console.error(`Error executing recurring ${r.id}:`, err);
    }
  }

  return Response.json({ ok: true, executed, skipped, total: recurrentes.length });
}
