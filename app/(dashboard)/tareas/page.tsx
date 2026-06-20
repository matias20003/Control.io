import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/feature-flags";
import { getTasks } from "@/lib/db/tasks";
import { getPendingReminders } from "@/lib/db/reminders";
import { getGoogleStatus, listCalendarEvents } from "@/lib/google";
import { TareasClient } from "./TareasClient";

export const metadata: Metadata = { title: "Organización" };

export default async function TareasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { isTester: true },
  });
  const isTester = profile?.isTester ?? false;
  if (!hasFeature("tareas", { isTester })) redirect("/dashboard");

  const [tasks, reminders, gstatus] = await Promise.all([
    getTasks(user.id),
    getPendingReminders(user.id).catch(() => []),
    getGoogleStatus(user.id).catch(() => ({ connected: false, email: null })),
  ]);

  const googleEnabled = hasFeature("google", { isTester });
  const events = googleEnabled && gstatus.connected
    ? await listCalendarEvents(user.id, { daysAhead: 14 }).catch(() => [])
    : [];

  return (
    <TareasClient
      initialTasks={tasks}
      reminders={reminders}
      events={events}
      googleConnected={gstatus.connected}
      googleEnabled={googleEnabled}
    />
  );
}
