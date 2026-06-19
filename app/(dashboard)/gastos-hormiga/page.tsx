import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/feature-flags";
import { getGastosHormiga } from "@/lib/db/gastos-hormiga";
import { GastosHormigaClient } from "./GastosHormigaClient";

export const metadata: Metadata = { title: "Gastos hormiga" };

export default async function GastosHormigaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Gateada por feature flag: si no está habilitada para este usuario, fuera.
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { isTester: true },
  });
  if (!hasFeature("gastosHormiga", { isTester: profile?.isTester ?? false })) {
    redirect("/dashboard");
  }

  const data = await getGastosHormiga(user.id);
  return <GastosHormigaClient data={data} />;
}
