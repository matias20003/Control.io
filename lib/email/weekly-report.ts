import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";

type WeekData = {
  income: number;
  expense: number;
  balance: number;
  topCategories: { name: string; icon: string; total: number }[];
  accountBalances: { name: string; currency: string; balance: number }[];
};

function toNum(v: unknown): number {
  if (!v) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

function fmt(amount: number, currency = "ARS"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function getWeeklyData(userId: string, weekStart: Date, weekEnd: Date): Promise<WeekData> {
  const [txs, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: weekStart, lte: weekEnd } },
      include: { category: { select: { name: true, icon: true } } },
    }),
    prisma.account.findMany({
      where: { userId, isActive: true },
      select: { name: true, currency: true, balance: true },
      orderBy: { balance: "desc" },
      take: 5,
    }),
  ]);

  let income = 0;
  let expense = 0;
  const catMap: Record<string, { name: string; icon: string; total: number }> = {};

  for (const tx of txs) {
    const amount = toNum(tx.amount);
    if (tx.type === "INCOME") {
      income += amount;
    } else {
      expense += amount;
      if (tx.category) {
        const k = tx.category.name;
        catMap[k] = catMap[k] ?? { name: k, icon: tx.category.icon ?? "📦", total: 0 };
        catMap[k].total += amount;
      }
    }
  }

  const topCategories = Object.values(catMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);

  return {
    income,
    expense,
    balance: income - expense,
    topCategories,
    accountBalances: accounts.map((a) => ({ name: a.name, currency: a.currency, balance: toNum(a.balance) })),
  };
}

export function buildWeeklyReportHtml(opts: {
  name: string;
  weekStart: Date;
  weekEnd: Date;
  data: WeekData;
  appUrl: string;
}): string {
  const { name, weekStart, weekEnd, data, appUrl } = opts;

  const period = `${format(weekStart, "d MMM", { locale: es })} – ${format(weekEnd, "d MMM yyyy", { locale: es })}`;
  const balanceColor = data.balance >= 0 ? "#22c55e" : "#ef4444";
  const savingsRate = data.income > 0 ? Math.round((data.balance / data.income) * 100) : 0;

  const categoriesHtml = data.topCategories.length
    ? data.topCategories
        .map(
          (c) => `
        <tr>
          <td style="padding:8px 0; color:#f8fafc; font-size:14px;">${c.icon} ${c.name}</td>
          <td style="padding:8px 0; color:#ef4444; font-size:14px; text-align:right; font-family:monospace;">${fmt(c.total)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="2" style="color:#94a3b8; font-size:13px; padding:8px 0;">Sin gastos esta semana 🎉</td></tr>`;

  const accountsHtml = data.accountBalances
    .map(
      (a) => `
      <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #334155;">
        <span style="color:#94a3b8; font-size:13px;">${a.name}</span>
        <span style="color:#f8fafc; font-size:13px; font-family:monospace;">${fmt(a.balance, a.currency)}</span>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reporte Semanal — control.io</title>
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#f8fafc;">
  <div style="max-width:560px; margin:0 auto; padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center; padding-bottom:32px; border-bottom:1px solid #334155;">
      <p style="margin:0; font-size:22px; font-weight:800; letter-spacing:-0.5px; color:#38bdf8;">control.io</p>
      <p style="margin:4px 0 0; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:2px;">systematic efficiency</p>
    </div>

    <!-- Greeting -->
    <div style="padding:28px 0 20px;">
      <h1 style="margin:0 0 8px; font-size:20px; font-weight:700; color:#f8fafc;">Hola, ${name} 👋</h1>
      <p style="margin:0; font-size:14px; color:#94a3b8;">Tu reporte financiero de la semana del <strong style="color:#f8fafc;">${period}</strong>.</p>
    </div>

    <!-- Metrics -->
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:28px;">
      <div style="background:#1e293b; border-radius:12px; padding:16px; text-align:center;">
        <p style="margin:0 0 4px; font-size:11px; color:#64748b; text-transform:uppercase;">Ingresos</p>
        <p style="margin:0; font-size:18px; font-weight:700; color:#22c55e; font-family:monospace;">${fmt(data.income)}</p>
      </div>
      <div style="background:#1e293b; border-radius:12px; padding:16px; text-align:center;">
        <p style="margin:0 0 4px; font-size:11px; color:#64748b; text-transform:uppercase;">Gastos</p>
        <p style="margin:0; font-size:18px; font-weight:700; color:#ef4444; font-family:monospace;">${fmt(data.expense)}</p>
      </div>
      <div style="background:#1e293b; border-radius:12px; padding:16px; text-align:center;">
        <p style="margin:0 0 4px; font-size:11px; color:#64748b; text-transform:uppercase;">Balance</p>
        <p style="margin:0; font-size:18px; font-weight:700; color:${balanceColor}; font-family:monospace;">${fmt(data.balance)}</p>
      </div>
    </div>

    <!-- Savings rate badge -->
    ${
      data.income > 0
        ? `<div style="background:${savingsRate >= 20 ? "#1d4ed820" : "#78350f20"}; border:1px solid ${savingsRate >= 20 ? "#3b82f6" : "#f59e0b"}; border-radius:8px; padding:12px 16px; margin-bottom:28px; text-align:center;">
        <p style="margin:0; font-size:13px; color:${savingsRate >= 20 ? "#38bdf8" : "#f59e0b"};">
          ${savingsRate >= 20 ? "🎯" : "⚠️"} Tasa de ahorro semanal: <strong>${savingsRate}%</strong>
          ${savingsRate >= 20 ? " — ¡Excelente semana!" : " — Podés mejorar"}
        </p>
      </div>`
        : ""
    }

    <!-- Top categories -->
    <div style="margin-bottom:28px;">
      <h2 style="margin:0 0 12px; font-size:14px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:1px;">Top categorías</h2>
      <div style="background:#1e293b; border-radius:12px; padding:12px 16px;">
        <table style="width:100%; border-collapse:collapse;">
          ${categoriesHtml}
        </table>
      </div>
    </div>

    <!-- Account balances -->
    ${
      data.accountBalances.length
        ? `<div style="margin-bottom:28px;">
        <h2 style="margin:0 0 12px; font-size:14px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:1px;">Saldos de cuentas</h2>
        <div style="background:#1e293b; border-radius:12px; padding:12px 16px;">
          ${accountsHtml}
        </div>
      </div>`
        : ""
    }

    <!-- CTA -->
    <div style="text-align:center; padding:20px 0 32px;">
      <a href="${appUrl}/dashboard"
         style="display:inline-block; background:#38bdf8; color:#0f172a; text-decoration:none; font-weight:700; font-size:14px; padding:12px 32px; border-radius:10px;">
        Ver dashboard completo →
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #334155; padding-top:20px; text-align:center;">
      <p style="margin:0; font-size:11px; color:#475569;">
        control.io — Tu sistema de finanzas personales.<br/>
        Recibís este email porque tenés reportes semanales activados.
      </p>
    </div>

  </div>
</body>
</html>`;
}
