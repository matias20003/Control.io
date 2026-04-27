import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAccounts } from "@/lib/db/accounts";
import { CuentasClient } from "./CuentasClient";

export const metadata: Metadata = { title: "Cuentas" };

export default async function CuentasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const accounts = await getAccounts(user.id);

  return <CuentasClient initialAccounts={accounts} />;
}
