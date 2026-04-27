import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getMonthSummary } from "@/lib/db/transactions";
import { getAccounts } from "@/lib/db/accounts";
import { getCategories } from "@/lib/db/categories";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatMonth, percentageOf } from "@/lib/utils";
import { TrendingUp, TrendingDown, Scale, PiggyBank, ChevronRight } from "lucide-react";
import { DashboardQuickAdd } from "./DashboardQuickAdd";
import { CategoryChart } from "./CategoryChart";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name =
    user.user_metadata?.name || user.email?.split("@")[0] || "Usuario";

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [summary, accounts, categories] = await Promise.all([
    getMonthSummary(user.id, month, year),
    getAccounts(user.id),
    getCategories(user.id),
  ]);

  const { totalIncome, totalExpense, balance, byCategory } = summary;
  const savingsRate =
    totalIncome > 0 ? percentageOf(balance, totalIncome) : 0;

  const totalBalanceARS = accounts
    .filter((a) => a.currency === "ARS")
    .reduce((s, a) => s + a.balance, 0);

  const metrics = [
    {
      label: "Balance del mes",
      value: formatCurrency(balance, "ARS"),
      icon: Scale,
      color: balance >= 0 ? "text-success" : "text-danger",
      bg: balance >= 0 ? "bg-success/10" : "bg-danger/10",
    },
    {
      label: "Ingresos",
      value: formatCurrency(totalIncome, "ARS"),
      icon: TrendingUp,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Gastos",
      value: formatCurrency(totalExpense, "ARS"),
      icon: TrendingDown,
      color: "text-danger",
      bg: "bg-danger/10",
    },
    {
      label: "Tasa de ahorro",
      value: `${savingsRate}%`,
      icon: PiggyBank,
      color: savingsRate >= 20 ? "text-primary" : "text-warning",
      bg: savingsRate >= 20 ? "bg-primary/10" : "bg-warning/10",
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Hola, {name} 👋
        </h1>
        <p className="text-sm text-muted mt-0.5 capitalize">
          {new Intl.DateTimeFormat("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(now)}
        </p>
      </div>

      {/* ── Quick add buttons (client) ── */}
      <DashboardQuickAdd accounts={accounts} categories={categories} />

      {/* ── Metrics ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider capitalize">
            {formatMonth(month, year)}
          </p>
          <Link
            href="/movimientos"
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            Ver movimientos
            <ChevronRight size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <Card key={m.label} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className={`inline-flex p-2 rounded-lg ${m.bg} mb-3`}>
                  <m.icon size={16} className={m.color} />
                </div>
                <p className="text-xs text-muted font-medium leading-tight">
                  {m.label}
                </p>
                <p
                  className={`text-lg font-bold font-mono mt-1 ${m.color} leading-tight`}
                >
                  {m.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Gastos por categoría ── */}
      {byCategory.length > 0 && (
        <CategoryChart data={byCategory} totalExpense={totalExpense} />
      )}

      {/* ── Cuentas ── */}
      {accounts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">
              Tus cuentas
            </p>
            <Link
              href="/cuentas"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              Ver todas
              <ChevronRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                      style={{
                        backgroundColor: account.color
                          ? `${account.color}20`
                          : "var(--color-surface-2)",
                      }}
                    >
                      {account.icon || "🏦"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground leading-tight">
                        {account.name}
                      </p>
                      <p className="text-xs text-muted">{account.currency}</p>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-bold font-mono ${
                      account.balance >= 0 ? "text-foreground" : "text-danger"
                    }`}
                  >
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {accounts.length > 1 && (
            <p className="text-xs text-muted text-right">
              Total en ARS:{" "}
              <span className="font-mono text-foreground font-semibold">
                {formatCurrency(totalBalanceARS, "ARS")}
              </span>
            </p>
          )}
        </div>
      )}

    </div>
  );
}
