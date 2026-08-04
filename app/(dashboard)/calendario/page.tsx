import type { Metadata } from "next";
import { OrganizationClient } from "@/components/organization/OrganizationClient";
import { dayFromParams, loadOrganizationPage } from "@/lib/organization-page";

export const metadata: Metadata = { title: "Organización" };

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string | string[] }>;
}) {
  const [{ isOwner, ...data }, params] = await Promise.all([loadOrganizationPage(), searchParams]);
  // Para el dueño esto es la sección Calendario del menú nuevo; para el resto
  // sigue siendo la pantalla única de Organización, con sus pestañas.
  return (
    <OrganizationClient
      section="calendar"
      tabbed={!isOwner}
      initialDay={dayFromParams(params)}
      {...data}
    />
  );
}
