import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CarreraClient } from "@/components/study/CarreraClient";
import { getCareer } from "@/lib/db/study-career";

export const metadata: Metadata = { title: "Mi carrera" };

export default async function CarreraPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect("/dashboard");

  const career = await getCareer(user.id);
  return <CarreraClient career={career} />;
}
