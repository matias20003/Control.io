import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getGrupos } from "@/lib/db/grupos";
import { GruposClient } from "./GruposClient";

export const metadata: Metadata = { title: "Grupos" };

export default async function GruposPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const grupos = await getGrupos(user.id);

  return <GruposClient initialGrupos={grupos} />;
}
