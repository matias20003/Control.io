import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCotizaciones } from "@/lib/cotizaciones";
import { CotizacionesClient } from "./CotizacionesClient";

export const metadata: Metadata = { title: "Cotizaciones" };

export default async function CotizacionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cotizaciones = await getCotizaciones().catch(() => []);

  return <CotizacionesClient initial={cotizaciones} />;
}
