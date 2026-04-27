import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCreditPurchases } from "@/lib/db/credit";
import { getAccounts } from "@/lib/db/accounts";
import { getCategories } from "@/lib/db/categories";
import { CuotasClient } from "./CuotasClient";

export const metadata: Metadata = { title: "Cuotas" };

export default async function CuotasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [purchases, accounts, categories] = await Promise.all([
    getCreditPurchases(user.id),
    getAccounts(user.id),
    getCategories(user.id),
  ]);

  return (
    <CuotasClient
      initialPurchases={purchases}
      accounts={accounts}
      categories={categories}
    />
  );
}
