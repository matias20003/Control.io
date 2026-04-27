import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getRecurrentes } from "@/lib/db/recurrentes";
import { getCategories } from "@/lib/db/categories";
import { RecurrentesClient } from "./RecurrentesClient";

export const metadata: Metadata = { title: "Recurrentes" };

export default async function RecurrentesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [recurrentes, categories] = await Promise.all([
    getRecurrentes(user.id),
    getCategories(user.id),
  ]);

  return (
    <RecurrentesClient
      initialRecurrentes={recurrentes}
      categories={categories}
    />
  );
}
