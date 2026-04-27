import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCategories } from "@/lib/db/categories";
import { ConfiguracionClient } from "./ConfiguracionClient";

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categories = await getCategories(user.id);

  const profileName =
    user.user_metadata?.name || user.email?.split("@")[0] || null;
  const profileEmail = user.email!;

  return (
    <ConfiguracionClient
      initialCategories={categories}
      profileName={profileName}
      profileEmail={profileEmail}
    />
  );
}
