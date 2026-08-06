import type { Metadata } from "next";
import { OrganizationDashboard } from "@/components/organization/OrganizationDashboard";
import { requireOwnerOrCalendar } from "@/lib/organization-page";

export const metadata: Metadata = { title: "Organización" };

export default async function OrganizacionPage() {
  const { initial, financeEvents } = await requireOwnerOrCalendar();
  return (
    <OrganizationDashboard
      tasks={initial.tasks}
      habits={initial.habits}
      financeEvents={financeEvents}
    />
  );
}
