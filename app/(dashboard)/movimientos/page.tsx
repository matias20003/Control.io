import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTransactions } from "@/lib/db/transactions";
import { getAccounts } from "@/lib/db/accounts";
import { getCategories } from "@/lib/db/categories";
import { MovimientosClient } from "./MovimientosClient";

export const metadata: Metadata = { title: "Movimientos" };

export default async function MovimientosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [transactions, accounts, categories] = await Promise.all([
    getTransactions(user.id, { month, year }),
    getAccounts(user.id),
    getCategories(user.id),
  ]);

  return (
    <MovimientosClient
      initialTransactions={transactions}
      accounts={accounts}
      categories={categories}
      initialMonth={month}
      initialYear={year}
    />
  );
}
