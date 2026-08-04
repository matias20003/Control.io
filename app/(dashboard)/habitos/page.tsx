import type { Metadata } from "next";
import { OrganizationClient } from "@/components/organization/OrganizationClient";
import { loadOrganizationPage } from "@/lib/organization-page";

export const metadata: Metadata = { title: "Hábitos" };

export default async function HabitosPage() {
  const data = await loadOrganizationPage();
  return <OrganizationClient section="habits" {...data} />;
}
