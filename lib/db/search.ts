import { searchTransactions } from "@/lib/db/transactions";
import { getAccounts } from "@/lib/db/accounts";
import { getCategories } from "@/lib/db/categories";
import { getDebts } from "@/lib/db/debts";
import { getGoals } from "@/lib/db/goals";

/**
 * Búsqueda global: cruza movimientos, cuentas, categorías, deudas y metas.
 * Los nombres están cifrados en la BD, así que se traen vía getters (que
 * descifran) y se filtran en memoria por substring.
 */
export async function searchEverything(userId: string, q: string) {
  const term = q.toLowerCase().trim();
  const empty = { transactions: [], accounts: [], categories: [], debts: [], goals: [] };
  if (!term) return empty;

  const [transactions, accounts, categories, debts, goals] = await Promise.all([
    searchTransactions(userId, term, 25).catch(() => []),
    getAccounts(userId).catch(() => []),
    getCategories(userId).catch(() => []),
    getDebts(userId).catch(() => []),
    getGoals(userId).catch(() => []),
  ]);

  const inc = (s?: string | null) => (s ?? "").toLowerCase().includes(term);

  return {
    transactions,
    accounts: accounts.filter((a) => inc(a.name)),
    categories: categories.filter((c) => inc(c.name)),
    debts: debts.filter((d) => inc(d.personName) || inc(d.description)),
    goals: goals.filter((g) => inc(g.name)),
  };
}

export type SearchResults = Awaited<ReturnType<typeof searchEverything>>;
