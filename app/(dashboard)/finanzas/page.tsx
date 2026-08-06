import type { Metadata } from "next";
import { FinanceDashboard } from "../dashboard/FinanceDashboard";

export const metadata: Metadata = { title: "Finanzas" };

/**
 * El tablero de la plata, con ruta propia. Es exactamente lo que hasta ahora
 * vivía en Inicio: no se rehizo nada, se le puso el nombre que le corresponde.
 */
export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  return <FinanceDashboard searchParams={searchParams} />;
}
