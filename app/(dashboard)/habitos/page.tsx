import type { Metadata } from "next";
import { OrganizationClient } from "@/components/organization/OrganizationClient";
import { requireOwnerOrCalendar } from "@/lib/organization-page";

export const metadata: Metadata = { title: "Hábitos" };

export default async function HabitosPage() {
  const data = await requireOwnerOrCalendar();
  return <OrganizationClient section="habits" {...data} />;
}
