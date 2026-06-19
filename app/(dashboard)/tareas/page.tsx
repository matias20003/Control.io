import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/feature-flags";
import { getTasks } from "@/lib/db/tasks";
import { TareasClient } from "./TareasClient";

export const metadata: Metadata = { title: "Tareas" };

export default async function TareasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { isTester: true },
  });
  if (!hasFeature("tareas", { isTester: profile?.isTester ?? false })) {
    redirect("/dashboard");
  }

  const tasks = await getTasks(user.id);
  return <TareasClient initialTasks={tasks} />;
}
