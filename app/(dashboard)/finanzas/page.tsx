import { redirect } from "next/navigation";

/**
 * El dashboard propio de Finanzas todavía no existe: hoy Inicio ES ese
 * dashboard (sus doce bloques son todos financieros). Hasta separarlos, el
 * pilar entra por ahí en vez de dar 404.
 */
export default function FinanzasPage() {
  redirect("/dashboard");
}
