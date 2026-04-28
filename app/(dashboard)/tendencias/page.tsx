import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTrends } from "@/lib/db/trends";
import { TendenciasClient } from "./TendenciasClient";

export const metadata: Metadata = { title: "Tendencias" };

export default async function TendenciasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trends = await getTrends(user.id, 6);

  return <TendenciasClient trends={trends} />;
}
