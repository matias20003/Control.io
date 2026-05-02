import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NuevoGrupoClient } from "./NuevoGrupoClient";

export const metadata: Metadata = { title: "Nuevo grupo" };

export default async function NuevoGrupoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <NuevoGrupoClient />;
}
