import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { addDays, startOfDay, format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { getRecurringOccurrences } from "@/lib/recurrence-schedule";
import { startOfTodayArg } from "@/lib/timezone";
import { recurringAccountStatus } from "@/lib/recurring-copy";

export type AgendaEvent = {
  id: string;
  type: "recurring" | "credit" | "debt";
  cashFlow: "income" | "expense";
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
  const today    = startOfTodayArg();
  const fromDate = today;
  const toDate   = addDays(today, days);

  const events: AgendaEvent[] = [];

  // Las 3 fuentes (cuotas, deudas, recurrentes) se piden en paralelo: antes
  // corrían en serie y eran la cola lenta del dashboard.
  const [creditInstallments, debts, recurrentes] = await Promise.all([
    prisma.creditInstallment.findMany({
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
    }),
    prisma.debt.findMany({
      where: {
        userId,
        isCompleted: false,
        dueDate: { gte: fromDate, lte: toDate },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.recurringTransaction.findMany({
      where: { userId, isActive: true },
      include: {
        category: { select: { name: true, icon: true } },
        account: { select: { name: true } },
      },
    }),
  ]);

  // ── 1. Próximas cuotas de crédito ──────────────────────────

  for (const inst of creditInstallments) {
    const d = new Date(inst.dueDate);
    events.push({
      id: `credit-${inst.id}`,
      type: "credit",
      cashFlow: "expense",
      title: decrypt(inst.creditPurchase.description) ?? inst.creditPurchase.description,
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
  for (const debt of debts) {
    if (!debt.dueDate) continue;
    const d = new Date(debt.dueDate);
    events.push({
      id: `debt-${debt.id}`,
      type: "debt",
      cashFlow: debt.direction === "I_OWE" ? "expense" : "income",
      title: decrypt(debt.personName) ?? debt.personName,
      subtitle: debt.direction === "I_OWE" ? "Debés" : "Te deben",
      amount: toNum(debt.totalAmount) - toNum(debt.paidAmount),
      currency: debt.currency,
      date: d.toISOString(),
      dateLabel: dateLabel(d, today),
      daysUntil: differenceInDays(startOfDay(d), today),
      icon: debt.direction === "I_OWE" ? "💸" : "🤝",
      color: debt.direction === "I_OWE" ? "#ef4444" : "#22c55e",
    });
  }

  // ── 3. Recurrentes que van a ejecutarse ────────────────────
  for (const r of recurrentes) {
    const dates = getRecurringOccurrences(r, today, toDate);
    for (const executionDate of dates) {
      events.push({
        id: `recurring-${r.id}-${format(executionDate, "yyyy-MM-dd")}`,
        type: "recurring",
        cashFlow: r.type === "INCOME" ? "income" : "expense",
        title: decrypt(r.description) ?? r.description,
        subtitle: `${r.category?.name ?? "Sin categoría"} · ${recurringAccountStatus(
          r.type,
          r.account ? decrypt(r.account.name) ?? r.account.name : null,
        )}`,
        amount: toNum(r.amount),
        currency: r.currency,
        date: executionDate.toISOString(),
        dateLabel: dateLabel(executionDate, today),
        daysUntil: differenceInDays(startOfDay(executionDate), today),
        icon: r.type === "INCOME" ? "💚" : r.category?.icon ?? "🔄",
        color: r.type === "INCOME" ? "#22c55e" : "#ef4444",
      });
    }
  }

  // Ordenar por fecha
  return events.sort((a, b) => a.daysUntil - b.daysUntil);
}
