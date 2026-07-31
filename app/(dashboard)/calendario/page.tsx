import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrganization } from "@/lib/db/organization";
import { getAgenda } from "@/lib/db/agenda";
import { getGoogleStatus } from "@/lib/google";
import { ensureCalendarWatch, syncGoogleOrganization } from "@/lib/google-organization";
import { OrganizationClient } from "./OrganizationClient";

export const metadata: Metadata = { title: "Organización" };

export default async function OrganizationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const google = await getGoogleStatus(user.id).catch(() => ({ connected: false, email: null }));
  if (google.connected) {
    await syncGoogleOrganization(user.id).catch(() => null);
    await ensureCalendarWatch(user.id).catch(() => null);
  }
  const [initial, financeEvents] = await Promise.all([
    getOrganization(user.id),
    getAgenda(user.id, 60).catch(() => []),
  ]);
  return <OrganizationClient initial={initial} financeEvents={financeEvents} googleConnected={google.connected} />;
}
