import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { searchEverything } from "@/lib/db/search";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/stat";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowUpDown, Wallet, Tag, HandCoins, Target, SearchX } from "lucide-react";

export const metadata: Metadata = { title: "Buscar" };

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const results = query
    ? await searchEverything(user.id, query)
    : { transactions: [], accounts: [], categories: [], debts: [], goals: [] };

  const total =
    results.transactions.length +
    results.accounts.length +
    results.categories.length +
    results.debts.length +
    results.goals.length;

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto space-y-5">
      <PageHeader
        title="Buscar"
        subtitle={query ? `${total} resultado${total !== 1 ? "s" : ""} para "${query}"` : "Buscá movimientos, cuentas, categorías, deudas y metas."}
      />

      {!query ? (
        <Card>
          <CardContent className="p-10 flex flex-col items-center text-center gap-2">
            <SearchX size={26} className="text-muted" />
            <p className="text-sm text-muted">Escribí algo en la barra de arriba para buscar en todo el sistema.</p>
          </CardContent>
        </Card>
      ) : total === 0 ? (
        <Card>
          <CardContent className="p-10 flex flex-col items-center text-center gap-2">
            <SearchX size={26} className="text-muted" />
            <p className="text-sm font-medium text-foreground">Sin resultados</p>
            <p className="text-xs text-muted">No encontré nada para “{query}”. Probá con otra palabra.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Movimientos */}
          {results.transactions.length > 0 && (
            <Section icon={ArrowUpDown} title="Movimientos" count={results.transactions.length}>
              {results.transactions.map((t) => {
                const isIncome = t.type === "INCOME";
                const isTransfer = t.type === "TRANSFER";
                return (
                  <Link key={t.id} href={`/movimientos?q=${encodeURIComponent(t.description || t.categoryName || "")}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/50 transition-colors">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: t.categoryColor ? `${t.categoryColor}22` : "var(--color-surface-2)" }}>
                      {t.categoryIcon || (isTransfer ? "🔁" : isIncome ? "💰" : "💸")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.description || t.categoryName || "Movimiento"}</p>
                      <p className="text-xs text-muted truncate">{formatDate(t.date)}{t.accountName ? ` · ${t.accountName}` : ""}{t.categoryName ? ` · ${t.categoryName}` : ""}</p>
                    </div>
                    <p className={`text-sm font-bold font-mono shrink-0 ${isIncome ? "text-success" : isTransfer ? "text-primary" : "text-danger"}`}>
                      {isTransfer && t.destinationAmount != null && t.destinationCurrency
                        ? <>{formatCurrency(t.amount, t.currency)} <span className="text-muted">→</span> {formatCurrency(t.destinationAmount, t.destinationCurrency)}</>
                        : <>{isIncome ? "+" : isTransfer ? "" : "−"}{formatCurrency(t.amount, t.currency)}</>}
                    </p>
                  </Link>
                );
              })}
            </Section>
          )}

          {/* Cuentas */}
          {results.accounts.length > 0 && (
            <Section icon={Wallet} title="Cuentas" count={results.accounts.length}>
              {results.accounts.map((a) => (
                <Link key={a.id} href="/cuentas" className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/50 transition-colors">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: a.color ? `${a.color}22` : "var(--color-surface-2)" }}>{a.icon || "🏦"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                    <p className="text-xs text-muted">{a.currency}</p>
                  </div>
                  <p className={`text-sm font-bold font-mono shrink-0 ${a.balance >= 0 ? "text-foreground" : "text-danger"}`}>{formatCurrency(a.balance, a.currency)}</p>
                </Link>
              ))}
            </Section>
          )}

          {/* Deudas */}
          {results.debts.length > 0 && (
            <Section icon={HandCoins} title="Deudas" count={results.debts.length}>
              {results.debts.map((d) => {
                const isOwe = d.direction === "I_OWE";
                return (
                  <Link key={d.id} href="/deudas" className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/50 transition-colors">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isOwe ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}><HandCoins size={16} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{d.personName}</p>
                      <p className="text-xs text-muted truncate">{isOwe ? "Le debo" : "Me debe"}{d.description ? ` · ${d.description}` : ""}</p>
                    </div>
                    <p className={`text-sm font-bold font-mono shrink-0 ${isOwe ? "text-danger" : "text-success"}`}>{formatCurrency(d.remainingAmount, d.currency)}</p>
                  </Link>
                );
              })}
            </Section>
          )}

          {/* Metas */}
          {results.goals.length > 0 && (
            <Section icon={Target} title="Metas" count={results.goals.length}>
              {results.goals.map((g) => (
                <Link key={g.id} href="/metas" className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/50 transition-colors">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-surface-2">{g.icon || "🎯"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                    <p className="text-xs text-muted">{g.percentage}% · {formatCurrency(g.currentAmount, g.currency)} de {formatCurrency(g.targetAmount, g.currency)}</p>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {/* Categorías */}
          {results.categories.length > 0 && (
            <Section icon={Tag} title="Categorías" count={results.categories.length}>
              {results.categories.map((c) => (
                <Link key={c.id} href="/configuracion" className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/50 transition-colors">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: c.color ? `${c.color}22` : "var(--color-surface-2)" }}>{c.icon || "🏷️"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted">{c.type === "INCOME" ? "Ingreso" : "Gasto"}</p>
                  </div>
                </Link>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Icon size={15} className="text-muted" />
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <span className="text-xs text-muted">({count})</span>
        </div>
        <div className="divide-y divide-border-subtle">{children}</div>
      </CardContent>
    </Card>
  );
}
