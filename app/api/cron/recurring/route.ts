import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { differenceInDays, isAfter, isBefore } from "date-fns";
import { sendPushToUser } from "@/lib/push/send";
import { encrypt, decrypt } from "@/lib/crypto";
import { startOfTodayArg } from "@/lib/timezone";
import { snapshotConversion } from "@/lib/exchange";
import { sendReactivationNudges } from "@/lib/reactivation";
import { sendDueReminders } from "@/lib/db/due-reminders";

// Vercel Cron: diariamente a las 11:00 UTC (08:00 ARG).
// Consolida recurrentes + reactivación (límite de 2 crons en Vercel Hobby).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // Si no hay secret configurado, denegar siempre
  if (process.env.NODE_ENV !== "production") return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
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
      // Día objetivo, acotado al último día en meses cortos (ej: 31 → 30/28).
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(r.dayOfMonth ?? r.lastExecuted.getDate(), daysInMonth);
      const notYetThisMonth =
        today.getMonth() !== r.lastExecuted.getMonth() ||
        today.getFullYear() !== r.lastExecuted.getFullYear();
      // Dispara el día objetivo O cualquier día posterior si el cron se lo
      // perdió, mientras no se haya ejecutado ya este mes (a lo sumo 1 vez/mes).
      return notYetThisMonth && today.getDate() >= targetDay;
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

  const today = startOfTodayArg();

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
      // Validar que la categoría / cuenta siguen siendo del mismo user.
      // Si la cuenta fue borrada dejamos accountId=null para que la tx
      // se cree sin impactar saldos, en vez de fallar el FK.
      let safeCategoryId: string | null = null;
      if (r.categoryId) {
        const cat = await prisma.category.findFirst({
          where: { id: r.categoryId, userId: r.userId },
          select: { id: true },
        });
        safeCategoryId = cat?.id ?? null;
      }
      let safeAccountId: string | null = null;
      if (r.accountId) {
        const acc = await prisma.account.findFirst({
          where: { id: r.accountId, userId: r.userId },
          select: { id: true },
        });
        safeAccountId = acc?.id ?? null;
      }

      const amountNum = parseFloat(String(r.amount));
      const { amountARS, exchangeRate } = await snapshotConversion(amountNum, r.currency);

      // r.description ya viene encriptado desde la tabla de recurrentes.
      // Lo desencriptamos para reutilizar el mismo nombre que puso el usuario
      // (evita el doble-encriptado que dejaba "enc:..." visible en la lista).
      const plainDescription = decrypt(r.description) ?? r.description;

      // Tx + actualización de saldo + lastExecuted, todo atómico.
      const ops: any[] = [
        prisma.transaction.create({
          data: {
            userId: r.userId,
            type: r.type,
            amount: r.amount,
            currency: r.currency,
            amountARS,
            exchangeRate,
            description: encrypt(plainDescription),
            date: today,
            categoryId: safeCategoryId,
            accountId: safeAccountId,
            notes: encrypt("✅ Ejecutado automáticamente"),
          },
        }),
        prisma.recurringTransaction.update({
          where: { id: r.id },
          data: { lastExecuted: today },
        }),
      ];
      if (safeAccountId) {
        const delta = r.type === "INCOME" ? amountNum : -amountNum;
        ops.push(
          prisma.account.update({
            where: { id: safeAccountId, userId: r.userId },
            data: { balance: { increment: delta } },
          }),
        );
      }
      await prisma.$transaction(ops);

      // Enviar push notification
      await sendPushToUser(r.userId, {
        title: "Movimiento recurrente registrado",
        body: `${r.type === "INCOME" ? "💚" : "🔴"} ${plainDescription} — ${new Intl.NumberFormat("es-AR", { style: "currency", currency: r.currency, minimumFractionDigits: 0 }).format(parseFloat(String(r.amount)))}`,
        url: "/movimientos",
      }).catch(() => {});

      executed++;
    } catch (err) {
      console.error(`Error executing recurring ${r.id}:`, err);
    }
  }

  // Reactivación de inactivos (consolidado acá, best-effort).
  const reactivation = await sendReactivationNudges().catch(() => ({ sent: 0, errors: 0, total: 0 }));

  // Recordatorios de vencimientos (cuotas + deudas que vencen hoy/mañana).
  const dues = await sendDueReminders().catch(() => ({ users: 0 }));

  // El newsletter ya NO se genera acá: pasó a un cron horario propio
  // (/api/cron/newsletter) para respetar el `sendHour` configurable por usuario.

  return Response.json({ ok: true, executed, skipped, total: recurrentes.length, reactivation, dues });
}
