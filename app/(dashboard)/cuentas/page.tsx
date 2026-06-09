import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAccounts } from "@/lib/db/accounts";
import { getTransactions } from "@/lib/db/transactions";
import { CuentasClient } from "./CuentasClient";

export const metadata: Metadata = { title: "Cuentas" };

export default async function CuentasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [accounts, recent] = await Promise.all([
    getAccounts(user.id),
    getTransactions(user.id, { take: 8 }).then((r) => r.items).catch(() => []),
  ]);

  return <CuentasClient initialAccounts={accounts} recentTx={recent} />;
}
