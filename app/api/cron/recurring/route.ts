import { NextRequest } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push/send";
import { encrypt, decrypt } from "@/lib/crypto";
import { startOfTodayArg } from "@/lib/timezone";
// Misma fuente de verdad que la agenda y los recordatorios de vencimiento: lo
// que el panel proyecta como próximo pago es exactamente lo que se ejecuta.
import { isRecurringDue } from "@/lib/recurrence-schedule";
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
  return bearerMatches(req.headers.get("authorization"), secret);
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
    if (!isRecurringDue(r, today)) {
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
