import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { sendPushToUser } from "@/lib/push/send";
import { sendText } from "@/lib/whatsapp/kapso";
import { startOfTodayArg } from "@/lib/timezone";
import { getRecurringOccurrences } from "@/lib/recurrence-schedule";

const DAY_MS = 24 * 60 * 60 * 1000;

function money(n: number, cur = "ARS"): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: cur, minimumFractionDigits: 0 }).format(n);
}
function num(v: unknown): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? 0));
}

/**
 * Recordatorio de vencimientos que caen HOY o MAÑANA (cuotas de crédito + deudas
 * que el usuario debe pagar). Cada ítem se recuerda como "mañana" la víspera y
 * "hoy" el día — máximo 2 avisos, sin necesidad de trackear. Push + WhatsApp.
 */
export async function sendDueReminders(): Promise<{ users: number }> {
  const today = startOfTodayArg();
  const upper = new Date(today.getTime() + 2 * DAY_MS); // hoy + mañana (exclusivo)

  const [credits, debts, recurring] = await Promise.all([
    prisma.creditInstallment.findMany({
      where: { isPaid: false, dueDate: { gte: today, lt: upper } },
      include: { creditPurchase: { select: { userId: true, description: true, currency: true } } },
    }),
    prisma.debt.findMany({
      where: { isCompleted: false, direction: "I_OWE", dueDate: { gte: today, lt: upper } },
      select: { userId: true, personName: true, totalAmount: true, paidAmount: true, currency: true, dueDate: true },
    }),
    prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        type: "EXPENSE",
        startDate: { lt: upper },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      include: { account: { select: { name: true } } },
    }),
  ]);

  const when = (d: Date) => (d.getTime() - today.getTime() < DAY_MS ? "Hoy" : "Mañana");

  const byUser = new Map<string, string[]>();
  const add = (userId: string, line: string) => {
    const arr = byUser.get(userId) ?? [];
    arr.push(line);
    byUser.set(userId, arr);
  };

  for (const c of credits) {
    add(
      c.creditPurchase.userId,
      `${when(new Date(c.dueDate))}: 💳 ${decrypt(c.creditPurchase.description) ?? "Cuota"} — ${money(num(c.amount), c.creditPurchase.currency)}`
    );
  }
  for (const d of debts) {
    if (!d.dueDate) continue;
    add(
      d.userId,
      `${when(new Date(d.dueDate))}: 💸 Pagarle a ${decrypt(d.personName) ?? d.personName} — ${money(num(d.totalAmount) - num(d.paidAmount), d.currency)}`
    );
  }
  for (const r of recurring) {
    const dates = getRecurringOccurrences(r, today, new Date(upper.getTime() - 1));
    const executedToday =
      !!r.lastExecuted &&
      r.lastExecuted.getTime() >= today.getTime() &&
      r.lastExecuted.getTime() < today.getTime() + DAY_MS;
    if (executedToday) dates.unshift(today);
    for (const date of dates) {
      if (date >= upper) continue;
      const description = decrypt(r.description) ?? r.description;
      const account = r.account ? decrypt(r.account.name) ?? r.account.name : null;
      const status = account
        ? `${executedToday && date.getTime() < today.getTime() + DAY_MS ? "descontado" : "se descuenta"} de ${account}`
        : "requiere pago · asigná una cuenta";
      add(r.userId, `${when(date)}: 🔁 ${description} — ${money(num(r.amount), r.currency)} · ${status}`);
    }
  }

  if (!byUser.size) return { users: 0 };

  const profiles = await prisma.profile.findMany({
    where: { id: { in: [...byUser.keys()] } },
    select: { id: true, whatsappNumber: true },
  });
  const waMap = new Map(profiles.map((p) => [p.id, p.whatsappNumber]));

  let users = 0;
  for (const [userId, lines] of byUser) {
    const title = lines.length === 1 ? "🔔 Tenés un vencimiento" : `🔔 Tenés ${lines.length} vencimientos`;

    // Push: sin el límite de la ventana de 24h de WhatsApp.
    sendPushToUser(userId, { title, body: lines.join("\n"), url: "/agenda" }).catch(() => {});

    // WhatsApp si está vinculado (best-effort).
    const wa = waMap.get(userId);
    if (wa) {
      sendText(
        wa,
        `${title}\n\n${lines.map((l) => `• ${l}`).join("\n")}\n\nVerlos en controlio.site/agenda`
      ).catch(() => {});
    }
    users++;
  }
  return { users };
}

/**
 * Versión "Probar ahora": muestra al usuario logueado sus próximos vencimientos
 * (cuotas + deudas a pagar) dentro de los próximos 30 días, para verificar el canal.
 */
export async function sendDueReminderToUser(
  userId: string
): Promise<{ ok: boolean; count: number; error?: string }> {
  const today = startOfTodayArg();
  const upper = new Date(today.getTime() + 30 * DAY_MS);

  const [credits, debts, recurring] = await Promise.all([
    prisma.creditInstallment.findMany({
      where: { isPaid: false, creditPurchase: { userId }, dueDate: { gte: today, lt: upper } },
      include: { creditPurchase: { select: { description: true, currency: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.debt.findMany({
      where: { userId, isCompleted: false, direction: "I_OWE", dueDate: { gte: today, lt: upper } },
      select: { personName: true, totalAmount: true, paidAmount: true, currency: true, dueDate: true },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        type: "EXPENSE",
        startDate: { lt: upper },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      include: { account: { select: { name: true } } },
    }),
  ]);

  const label = (d: Date) => {
    const diff = Math.round((d.getTime() - today.getTime()) / DAY_MS);
    if (diff <= 0) return "Hoy";
    if (diff === 1) return "Mañana";
    return `En ${diff} días`;
  };

  const lines: string[] = [];
  for (const c of credits) {
    lines.push(
      `${label(new Date(c.dueDate))}: 💳 ${decrypt(c.creditPurchase.description) ?? "Cuota"} — ${money(num(c.amount), c.creditPurchase.currency)}`
    );
  }
  for (const d of debts) {
    if (!d.dueDate) continue;
    lines.push(
      `${label(new Date(d.dueDate))}: 💸 Pagarle a ${decrypt(d.personName) ?? d.personName} — ${money(num(d.totalAmount) - num(d.paidAmount), d.currency)}`
    );
  }
  for (const r of recurring) {
    const occurrences = getRecurringOccurrences(r, today, new Date(upper.getTime() - 1));
    const executedToday =
      !!r.lastExecuted &&
      r.lastExecuted.getTime() >= today.getTime() &&
      r.lastExecuted.getTime() < today.getTime() + DAY_MS;
    if (executedToday) occurrences.unshift(today);
    for (const date of occurrences.slice(0, 3)) {
      const description = decrypt(r.description) ?? r.description;
      const account = r.account ? decrypt(r.account.name) ?? r.account.name : null;
      lines.push(
        `${label(date)}: 🔁 ${description} — ${money(num(r.amount), r.currency)} · ${
          account ? `${executedToday && date.getTime() < today.getTime() + DAY_MS ? "descontado" : "se descuenta"} de ${account}` : "requiere pago · asigná una cuenta"
        }`
      );
    }
  }

  if (!lines.length) {
    return { ok: false, count: 0, error: "No tenés cuotas, deudas ni gastos fijos próximos en los próximos 30 días." };
  }

  const title = lines.length === 1 ? "🔔 Tu próximo vencimiento" : `🔔 Tus próximos ${lines.length} vencimientos`;
  await sendPushToUser(userId, { title, body: lines.join("\n"), url: "/agenda" }).catch(() => {});

  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { whatsappNumber: true } });
  if (profile?.whatsappNumber) {
    await sendText(
      profile.whatsappNumber,
      `${title}\n\n${lines.map((l) => `• ${l}`).join("\n")}\n\nVerlos en controlio.site/agenda`
    ).catch(() => {});
  }

  return { ok: true, count: lines.length };
}
