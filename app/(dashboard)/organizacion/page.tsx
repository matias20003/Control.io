import { redirect } from "next/navigation";

/**
 * Hasta que Organización tenga su propio resumen, el pilar entra por Hoy, que
 * es la pantalla con la que se arranca el día.
 */
export default function OrganizacionPage() {
  redirect("/hoy");
}
