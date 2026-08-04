import type { Metadata } from "next";
import { OrganizationClient } from "@/components/organization/OrganizationClient";
import { dayFromParams, requireOwnerOrCalendar } from "@/lib/organization-page";

export const metadata: Metadata = { title: "Hoy" };

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string | string[] }>;
}) {
  const [data, params] = await Promise.all([requireOwnerOrCalendar(), searchParams]);
  return <OrganizationClient section="today" initialDay={dayFromParams(params)} {...data} />;
}
