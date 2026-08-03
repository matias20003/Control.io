import { NextRequest } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push/send";
import { startOfTodayArg } from "@/lib/timezone";
// El alta con "descontarlo ya" y el botón "registrar pago" comparten esta misma
// ejecución, para que el saldo de la cuenta se mueva igual venga de donde venga.
import { executeRecurringOnce } from "@/lib/db/recurring-execute";
// Misma fuente de verdad que la agenda y los recordatorios de vencimiento: lo
// que el panel proyecta como próximo pago es exactamente lo que se ejecuta.
import { isRecurringDue } from "@/lib/recurrence-schedule";
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
      const { executed: didExecute, description: plainDescription } =
        await executeRecurringOnce(r, today);

      if (!didExecute) {
        skipped++;
        continue;
      }

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
