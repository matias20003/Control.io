import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTrends } from "@/lib/db/trends";
import { TendenciasClient } from "./TendenciasClient";
import { sectionFeatures } from "@/lib/section-features";

export const metadata: Metadata = { title: "Tendencias" };

export default async function TendenciasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [trends, features] = await Promise.all([
    getTrends(user.id, 6),
    sectionFeatures(user.id),
  ]);

  return <TendenciasClient trends={trends} features={features} />;
}
