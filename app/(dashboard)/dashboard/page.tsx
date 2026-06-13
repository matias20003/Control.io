import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getMonthSummary, getTransactions } from "@/lib/db/transactions";
import { getAccounts } from "@/lib/db/accounts";
import { getCategories } from "@/lib/db/categories";
import { getInsights } from "@/lib/db/insights";
import { getTrends } from "@/lib/db/trends";
import { getGoals } from "@/lib/db/goals";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, percentageOf } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, PiggyBank, ChevronRight, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle2, Info, Target, CalendarClock, Wallet,
} from "lucide-react";
import { getAgenda } from "@/lib/db/agenda";
import { DashboardQuickAdd } from "./DashboardQuickAdd";
import { CategoryChart } from "./CategoryChart";
import { IncomeExpenseChart, BalanceSparkline } from "./DashboardCharts";
import { TodayDate } from "./TodayDate";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { GuidedTour } from "@/components/GuidedTour";
import { WhatsappPromoModal } from "@/components/WhatsappPromoModal";
import { getOnboardingState } from "@/lib/db/onboarding";
import { getProfileWhatsapp } from "@/lib/db/profile";
import { getStreakInfo } from "@/lib/db/streak";
import { nextStreakMilestone } from "@/lib/streak-utils";
import { StreakCelebration } from "./StreakCelebration";

export const metadata: Metadata = { title: "Dashboard" };

function pctDelta(a?: number, b?: number): number | null {
  if (a == null || b == null || b === 0) return null;
  return Math.round(((a - b) / Math.abs(b)) * 100);
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { welcome } = await searchParams;
  const name = user.user_metadata?.name || user.email?.split("@")[0] || "Usuario";

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [summary, accounts, categories, insights, trends, goals, recent, onboarding, whatsappNumber, streakInfo] =
    await Promise.all([
      getMonthSummary(user.id, month, year),
      getAccounts(user.id),
      getCategories(user.id),
      getInsights(user.id).catch(() => []),
      getTrends(user.id, 6).catch(() => null),
      getGoals(user.id).catch(() => []),
      getTransactions(user.id, { take: 6 }).then((r) => r.items).catch(() => []),
      getOnboardingState(user.id),
      getProfileWhatsapp(user.id).catch(() => null),
      getStreakInfo(user.id).catch(() => ({ current: 0, longest: 0 })),
    ]);

  const streak = streakInfo.current;
  const nextMilestone = nextStreakMilestone(streak);
  const streakSubtitle =
    streak >= 1 && streak === streakInfo.longest && streak > 1
      ? "🏆 ¡tu récord!"
      : nextMilestone
        ? `faltan ${nextMilestone - streak} para ${nextMilestone} 🎯`
        : "¡de racha! 💪";

  const agenda = await getAgenda(user.id, 30).catch(() => []);

  const { totalIncome, totalExpense, balance, byCategory } = summary;
  const savingsRate = totalIncome > 0 ? percentageOf(balance, totalIncome) : 0;

  // Series mensuales (para charts + comparativas vs mes anterior)
  const series = trends?.months ?? [];
  const cur = series[series.length - 1];
  const prev = series[series.length - 2];
  const balanceSeries = series.map((m) => ({ label: m.label, balance: m.balance }));
  const ieSeries = series.map((m) => ({ label: m.label, income: m.income, expense: m.expense, balance: m.balance }));
  const balanceDelta = cur && prev ? cur.balance - prev.balance : null;
  const incomeDelta = pctDelta(cur?.income, prev?.income);
  const expenseDelta = pctDelta(cur?.expense, prev?.expense);
  const savingsDelta = cur && prev ? Math.round(cur.savingsRate - prev.savingsRate) : null;

  const totalBalanceARS = accounts
    .filter((a) => a.currency === "ARS")
    .reduce((s, a) => s + a.balance, 0);

  // Objetivo principal: el de mayor avance sin completar
  const topGoal =
    goals.filter((g) => !g.isCompleted).sort((a, b) => b.percentage - a.percentage)[0] ?? null;

  const resumen = [
    { label: "Ingresos", value: totalIncome, icon: TrendingUp, color: "text-success", bg: "bg-success/10", delta: incomeDelta, deltaGood: (incomeDelta ?? 0) >= 0 },
    { label: "Gastos", value: totalExpense, icon: TrendingDown, color: "text-danger", bg: "bg-danger/10", delta: expenseDelta, deltaGood: (expenseDelta ?? 0) <= 0 },
    { label: "Ahorro", value: balance, icon: PiggyBank, color: "text-primary", bg: "bg-primary/10", delta: savingsDelta, deltaGood: (savingsDelta ?? 0) >= 0, isPts: true },
  ];

  const INSIGHT_ICONS: Record<string, React.ElementType> = { warning: AlertTriangle, success: CheckCircle2, info: Info };
  const INSIGHT_COLORS: Record<string, string> = { warning: "text-warning", success: "text-success", info: "text-primary" };

  const balanceBetter = balanceDelta != null && balanceDelta >= 0;

  // Card "Objetivo principal" reutilizable: en desktop va en la fila hero,
  // en mobile se muestra más abajo (después de Movimientos recientes).
  const objetivoCard = (
    <Card>
      <CardContent className="p-5 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Objetivo principal</p>
          <Link href="/metas" className="text-xs text-primary hover:underline flex items-center gap-0.5">
            Ver metas <ChevronRight size={12} />
          </Link>
        </div>
        {topGoal ? (
          <div className="mt-2 flex-1 flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{topGoal.icon || "🎯"}</span>
              <p className="text-lg font-bold text-foreground leading-tight">{topGoal.name}</p>
            </div>
            <p className="text-3xl font-bold font-mono mt-3" style={{ color: topGoal.color || "var(--color-primary)" }}>
              {topGoal.percentage}%
            </p>
            <p className="text-xs text-muted mt-1">
              {formatCurrency(topGoal.currentAmount, topGoal.currency)} de {formatCurrency(topGoal.targetAmount, topGoal.currency)}
            </p>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden mt-3">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${topGoal.percentage}%`, backgroundColor: topGoal.color || "var(--color-primary)" }}
              />
            </div>
          </div>
        ) : (
          <Link href="/metas" className="mt-4 flex-1 flex flex-col items-center justify-center text-center gap-2 rounded-xl border border-dashed border-border py-6 hover:border-primary transition-colors">
            <Target size={22} className="text-muted" />
            <p className="text-sm font-medium text-foreground">Creá tu primer objetivo</p>
            <p className="text-xs text-muted">Definí una meta de ahorro y seguí tu avance</p>
          </Link>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-5">

      <WhatsappPromoModal isLinked={!!whatsappNumber} />

      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Hola, {name} 👋</h1>
          <TodayDate />
        </div>
        {streak >= 1 ? (
          <div
            className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1"
            title={`Racha de ${streak} días · récord ${streakInfo.longest} · ${streakSubtitle}`}
          >
            <span className="text-sm leading-none">🔥</span>
            <span className="text-xs font-semibold text-foreground">
              {streak} {streak === 1 ? "día" : "días"}
            </span>
          </div>
        ) : (
          <div
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1"
            title={streakInfo.longest > 1 ? `Tu récord es de ${streakInfo.longest} días. ¡Retomala hoy!` : "Registrá un movimiento hoy para arrancar tu racha."}
          >
            <span className="text-sm leading-none opacity-50 grayscale">🔥</span>
            <span className="text-xs font-medium text-muted">Sin racha</span>
          </div>
        )}
        <StreakCelebration current={streak} />
      </div>

      <OnboardingChecklist state={onboarding} />
      <GuidedTour enabled={welcome === "1"} userName={name} />
      <DashboardQuickAdd accounts={accounts} categories={categories} />

      {/* Banner comparativo del mes */}
      {balanceDelta != null && (
        <Card>
          <CardContent className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${balanceBetter ? "bg-success/10" : "bg-danger/10"}`}>
                {balanceBetter ? <TrendingUp size={18} className="text-success" /> : <TrendingDown size={18} className="text-danger" />}
              </span>
              <p className="text-sm font-medium text-foreground">
                {balanceBetter ? "Este mes viene mejor que el anterior" : "Este mes vas por debajo del anterior"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-bold font-mono ${balanceBetter ? "text-success" : "text-danger"}`}>
                {balanceBetter ? "+" : ""}{formatCurrency(balanceDelta, "ARS")}
              </p>
              <p className="text-[11px] text-muted">vs. mes anterior</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── HERO ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Balance del mes (ingresos − gastos) — NO es el saldo total de cuentas */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Balance del mes</p>
            <p className={`text-3xl md:text-4xl font-bold font-mono mt-2 ${balance >= 0 ? "text-foreground" : "text-danger"}`}>
              {formatCurrency(balance, "ARS")}
            </p>
            <p className="text-xs text-muted mt-1">ingresos menos gastos de este mes</p>
            {balanceDelta != null && (
              <div className={`inline-flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-lg text-xs font-medium ${balanceBetter ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                {balanceBetter ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {formatCurrency(Math.abs(balanceDelta), "ARS")} {balanceBetter ? "más" : "menos"} que el mes pasado
              </div>
            )}
            {balanceSeries.length > 1 && (
              <div className="mt-3">
                <BalanceSparkline data={balanceSeries} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Objetivo principal — en desktop acá; en mobile baja después de Movimientos */}
        <div className="hidden lg:block">{objetivoCard}</div>

        {/* Resumen del mes */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Resumen del mes</p>
            <div className="mt-3 space-y-3">
              {resumen.map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${r.bg}`}>
                    <r.icon size={17} className={r.color} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted leading-tight">{r.label}</p>
                    <p className="text-base font-bold font-mono text-foreground leading-tight">
                      {formatCurrency(r.value, "ARS")}
                    </p>
                  </div>
                  {r.delta != null && (
                    <div className={`flex items-center gap-0.5 text-xs font-semibold shrink-0 ${r.deltaGood ? "text-success" : "text-danger"}`}>
                      {r.deltaGood ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      {Math.abs(r.delta)}{r.isPts ? " p.p." : "%"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Evolución ingresos vs gastos */}
        {ieSeries.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">Evolución de ingresos vs gastos</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-muted"><span className="w-2.5 h-2.5 rounded-sm bg-success" /> Ingresos</span>
                  <span className="flex items-center gap-1.5 text-muted"><span className="w-2.5 h-2.5 rounded-sm bg-danger" /> Gastos</span>
                </div>
              </div>
              <IncomeExpenseChart data={ieSeries} />
            </CardContent>
          </Card>
        )}

        {/* Gastos por categoría */}
        {byCategory.length > 0 ? (
          <CategoryChart data={byCategory} totalExpense={totalExpense} />
        ) : (
          <Card>
            <CardContent className="p-5 h-full flex flex-col items-center justify-center text-center gap-2 min-h-[240px]">
              <span className="text-3xl opacity-70">📊</span>
              <p className="text-sm font-medium text-foreground">Sin gastos este mes</p>
              <p className="text-xs text-muted">Cargá movimientos para ver el desglose por categoría</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── THREE CARDS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Movimientos recientes */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Movimientos recientes</p>
              <Link href="/movimientos" className="text-xs text-primary hover:underline">Ver todos</Link>
            </div>
            {recent.length > 0 ? (
              <div className="space-y-1">
                {recent.map((t) => {
                  const isIncome = t.type === "INCOME";
                  const isTransfer = t.type === "TRANSFER";
                  const sign = isIncome ? "+" : isTransfer ? "" : "−";
                  const amtColor = isIncome ? "text-success" : isTransfer ? "text-primary" : "text-danger";
                  return (
                    <div key={t.id} className="flex items-center gap-3 py-2">
                      <span
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0"
                        style={{ backgroundColor: t.categoryColor ? `${t.categoryColor}22` : "var(--color-surface-2)" }}
                      >
                        {t.categoryIcon || (isTransfer ? "🔁" : isIncome ? "💰" : "💸")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight truncate">
                          {t.description || t.categoryName || (isTransfer ? "Transferencia" : isIncome ? "Ingreso" : "Gasto")}
                        </p>
                        <p className="text-xs text-muted truncate">{t.categoryName || t.accountName || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold font-mono ${amtColor}`}>
                          {sign}{formatCurrency(t.amount, t.currency)}
                        </p>
                        <p className="text-[11px] text-muted">{relTime(t.date)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted py-6 text-center">Todavía no hay movimientos este mes.</p>
            )}
          </CardContent>
        </Card>

        {/* Objetivo principal — solo en mobile, justo debajo de Movimientos */}
        <div className="lg:hidden">{objetivoCard}</div>

        {/* Insights para vos */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Insights para vos</p>
              <Link href="/reporte" className="text-xs text-primary hover:underline">Ver más</Link>
            </div>
            {insights.length > 0 ? (
              <div className="space-y-2.5">
                {insights.slice(0, 4).map((ins, i) => {
                  const Icon = INSIGHT_ICONS[ins.type] ?? Info;
                  return (
                    <div key={i} className="flex gap-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-surface-2 ${INSIGHT_COLORS[ins.type]}`}>
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium leading-tight ${INSIGHT_COLORS[ins.type]}`}>{ins.title}</p>
                        <p className="text-xs text-muted mt-0.5 leading-snug">{ins.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted py-6 text-center">Cargá más movimientos para generar insights.</p>
            )}
          </CardContent>
        </Card>

        {/* Tus cuentas */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Tus cuentas</p>
              <Link href="/cuentas" className="text-xs text-primary hover:underline">Ver todas</Link>
            </div>
            {accounts.length > 0 ? (
              <>
                <div className="space-y-1">
                  {accounts.slice(0, 4).map((account) => (
                    <div key={account.id} className="flex items-center gap-3 py-2">
                      <span
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0"
                        style={{ backgroundColor: account.color ? `${account.color}22` : "var(--color-surface-2)" }}
                      >
                        {account.icon || "🏦"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight truncate">{account.name}</p>
                        <p className="text-xs text-muted">{account.currency}</p>
                      </div>
                      <p className={`text-sm font-bold font-mono shrink-0 ${account.balance >= 0 ? "text-foreground" : "text-danger"}`}>
                        {formatCurrency(account.balance, account.currency)}
                      </p>
                    </div>
                  ))}
                </div>
                {accounts.length > 1 && (
                  <div className="border-t border-border mt-2 pt-3 flex items-center justify-between">
                    <p className="text-xs text-muted">Total en ARS</p>
                    <p className="text-sm font-bold font-mono text-foreground">{formatCurrency(totalBalanceARS, "ARS")}</p>
                  </div>
                )}
              </>
            ) : (
              <Link href="/cuentas" className="flex flex-col items-center justify-center text-center gap-2 py-6 text-muted hover:text-primary transition-colors">
                <Wallet size={20} />
                <p className="text-xs">Agregá tu primera cuenta</p>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── PRÓXIMOS PAGOS ── */}
      {agenda.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CalendarClock size={15} className="text-muted" /> Próximos pagos
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {agenda.slice(0, 6).map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-xl bg-surface-2/50 px-3 py-2.5">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: `${e.color}22` }}
                  >
                    {e.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight truncate">{e.title}</p>
                    <p className="text-xs text-muted">{e.subtitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold font-mono" style={{ color: e.color }}>
                      {formatCurrency(e.amount, e.currency)}
                    </p>
                    <p className="text-[11px] text-muted">{e.daysUntil === 0 ? "Hoy" : `en ${e.daysUntil}d`}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
