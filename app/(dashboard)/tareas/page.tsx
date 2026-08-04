import type { Metadata } from "next";
import { OrganizationClient } from "@/components/organization/OrganizationClient";
import { requireOwnerOrCalendar } from "@/lib/organization-page";

export const metadata: Metadata = { title: "Tareas" };

export default async function TareasPage() {
  const data = await requireOwnerOrCalendar();
  return <OrganizationClient section="tasks" {...data} />;
}
