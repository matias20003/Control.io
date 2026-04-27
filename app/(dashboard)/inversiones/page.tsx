import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getInvestments } from "@/lib/db/investments";
import { getDolarRates } from "@/lib/services/dolar";
import { InversionesClient } from "./InversionesClient";

export const metadata: Metadata = { title: "Inversiones" };

export default async function InversionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [investments, rates] = await Promise.all([
    getInvestments(user.id),
    getDolarRates(),
  ]);

  return <InversionesClient initialInvestments={investments} rates={rates} />;
}
