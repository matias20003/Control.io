import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MyCircleClient } from "@/app/(dashboard)/newsletter/MyCircleClient";
import { loadCirclePage } from "@/lib/circle-page";

export const metadata: Metadata = { title: "Mi Círculo" };
export const maxDuration = 60;

export default async function CirculoPage() {
  const { isOwner, props } = await loadCirclePage();
  // Las rutas por sección son parte del rediseño en prueba. Quien no lo tiene
  // sigue entrando por /newsletter, que muestra exactamente lo mismo.
  if (!isOwner) redirect("/newsletter");
  return <MyCircleClient {...props} initialSection="home" syncUrl />;
}
