import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getReporteSemanal } from "@/lib/db/reporte-semanal";
import { ReporteClient } from "./ReporteClient";
import { sectionFeatures } from "@/lib/section-features";

export const metadata: Metadata = { title: "Reporte Semanal" };

export default async function ReportePage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { semana } = await searchParams;
  const offset = Math.max(0, Math.min(12, parseInt(semana ?? "0") || 0));

  const [reporte, features] = await Promise.all([
    getReporteSemanal(user.id, offset),
    sectionFeatures(user.id),
  ]);

  return <ReporteClient reporte={reporte} currentOffset={offset} features={features} />;
}
