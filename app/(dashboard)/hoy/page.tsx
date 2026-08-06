import type { Metadata } from "next";
import { OrganizationClient } from "@/components/organization/OrganizationClient";
import { dayFromParams, loadDayWithStudy } from "@/lib/organization-page";

export const metadata: Metadata = { title: "Hoy" };

const TZ = "America/Argentina/Buenos_Aires";

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string | string[] }>;
}) {
  const params = await searchParams;
  const day = dayFromParams(params) ?? new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const { study, ...data } = await loadDayWithStudy(day);
  return <OrganizationClient section="today" initialDay={dayFromParams(params)} study={study} {...data} />;
}
