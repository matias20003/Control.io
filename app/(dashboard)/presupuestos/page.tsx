import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getBudgets } from "@/lib/db/budgets";
import { getCategories } from "@/lib/db/categories";
import { PresupuestosClient } from "./PresupuestosClient";

export const metadata: Metadata = { title: "Presupuestos" };

export default async function PresupuestosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [budgets, categories] = await Promise.all([
    getBudgets(user.id, month, year),
    getCategories(user.id),
  ]);

  return (
    <PresupuestosClient
      initialBudgets={budgets}
      categories={categories}
      initialMonth={month}
      initialYear={year}
    />
  );
}
