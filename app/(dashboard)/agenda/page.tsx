import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAgenda } from "@/lib/db/agenda";
import { AgendaClient } from "./AgendaClient";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const events = await getAgenda(user.id, 30);

  return <AgendaClient events={events} />;
}
