import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getDebts } from "@/lib/db/debts";
import { DeudasClient } from "./DeudasClient";

export const metadata: Metadata = { title: "Deudas" };

export default async function DeudasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const debts = await getDebts(user.id);

  return <DeudasClient initialDebts={debts} />;
}
