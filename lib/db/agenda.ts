import { prisma } from "@/lib/prisma";
import { addDays, startOfDay, format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

export type AgendaEvent = {
  id: string;
  type: "recurring" | "credit" | "debt";
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  date: string;        // ISO string
  dateLabel: string;   // "Hoy", "Mañana", "dd/MM"
  daysUntil: number;
  icon: string;
  color: string;
  isPaid?: boolean;
};

function toNum(v: unknown): number {
  if (!v) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

function dateLabel(date: Date, today: Date): string {
  const diff = differenceInDays(startOfDay(date), startOfDay(today));
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff <= 6) return format(date, "EEEE", { locale: es });
  return format(date, "d MMM", { locale: es });
}

export async function getAgenda(userId: string, days = 30): Promise<AgendaEvent[]> {
  const today    = startOfDay(new Date());
  const fromDate = today;
  const toDate   = addDays(today, days);

  const events: AgendaEvent[] = [];

  // ── 1. Próximas cuotas de crédito ──────────────────────────
  const creditInstallments = await prisma.creditInstallment.findMany({
    where: {
      creditPurchase: { userId },
      isPaid: false,
      dueDate: { gte: fromDate, lte: toDate },
    },
    include: {
      creditPurchase: {
        select: { description: true, totalInstallments: true, currency: true },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 20,
  });

  for (const inst of creditInstallments) {
    const d = new Date(inst.dueDate);
    events.push({
      id: `credit-${inst.id}`,
      type: "credit",
      title: inst.creditPurchase.description,
      subtitle: `Cuota ${inst.installmentNumber}/${inst.creditPurchase.totalInstallments}`,
      amount: toNum(inst.amount),
      currency: inst.creditPurchase.currency,
      date: d.toISOString(),
      dateLabel: dateLabel(d, today),
      daysUntil: differenceInDays(startOfDay(d), today),
      icon: "💳",
      color: "#6366f1",
    });
  }

  // ── 2. Vencimientos de deudas ──────────────────────────────
  const debts = await prisma.debt.findMany({
    where: {
      userId,
      isCompleted: false,
      dueDate: { gte: fromDate, lte: toDate },
    },
    orderBy: { dueDate: "asc" },
    take: 10,
  });

  for (const debt of debts) {
    if (!debt.dueDate) continue;
    const d = new Date(debt.dueDate);
    events.push({
      id: `debt-${debt.id}`,
      type: "debt",
      title: debt.personName,
      subtitle: debt.direction === "I_OWE" ? "Te deben" : "Debés",
      amount: toNum(debt.totalAmount) - toNum(debt.paidAmount),
      currency: debt.currency,
      date: d.toISOString(),
      dateLabel: dateLabel(d, today),
      daysUntil: differenceInDays(startOfDay(d), today),
      icon: debt.direction === "I_OWE" ? "🤝" : "💸",
      color: debt.direction === "I_OWE" ? "#22c55e" : "#ef4444",
    });
  }

  // ── 3. Recurrentes que van a ejecutarse ────────────────────
  const recurrentes = await prisma.recurringTransaction.findMany({
    where: { userId, isActive: true },
    include: { category: { select: { name: true, icon: true } } },
  });

  for (const r of recurrentes) {
    const nextDate = getNextExecutionDate(r, today);
    if (!nextDate) continue;
    if (nextDate > toDate) continue;

    events.push({
      id: `recurring-${r.id}`,
      type: "recurring",
      title: r.description,
      subtitle: `${r.category?.name ?? "Sin categoría"} · ${r.frequency}`,
      amount: toNum(r.amount),
      currency: r.currency,
      date: nextDate.toISOString(),
      dateLabel: dateLabel(nextDate, today),
      daysUntil: differenceInDays(startOfDay(nextDate), today),
      icon: r.type === "INCOME" ? "💚" : r.category?.icon ?? "🔄",
      color: r.type === "INCOME" ? "#22c55e" : "#ef4444",
    });
  }

  // Ordenar por fecha
  return events.sort((a, b) => a.daysUntil - b.daysUntil);
}

function getNextExecutionDate(
  r: { frequency: string; dayOfMonth: number | null; startDate: Date; endDate: Date | null; lastExecuted: Date | null },
  today: Date
): Date | null {
  if (r.endDate && r.endDate < today) return null;

  const last = r.lastExecuted ? startOfDay(r.lastExecuted) : null;

  const freq: Record<string, number> = {
    DAILY: 1,
    WEEKLY: 7,
    BIWEEKLY: 14,
    QUARTERLY: 90,
    YEARLY: 365,
  };

  if (r.frequency === "MONTHLY") {
    const targetDay = r.dayOfMonth ?? (last?.getDate() ?? today.getDate());
    let next = new Date(today.getFullYear(), today.getMonth(), targetDay);
    if (next <= today) next = new Date(today.getFullYear(), today.getMonth() + 1, targetDay);
    return next;
  }

  const interval = freq[r.frequency];
  if (!interval) return null;

  if (!last) {
    const start = startOfDay(r.startDate);
    return start >= today ? start : today;
  }

  const next = addDays(last, interval);
  return next >= today ? next : addDays(today, 0);
}
