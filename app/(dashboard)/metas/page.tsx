import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getGoals } from "@/lib/db/goals";
import { getAccounts } from "@/lib/db/accounts";
import { MetasClient } from "./MetasClient";

export const metadata: Metadata = { title: "Metas de ahorro" };

export default async function MetasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [goals, accounts] = await Promise.all([
    getGoals(user.id),
    getAccounts(user.id),
  ]);

  return <MetasClient initialGoals={goals} accounts={accounts} />;
}
