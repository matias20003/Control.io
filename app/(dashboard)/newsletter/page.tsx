import type { Metadata } from "next";
import { MyCircleClient } from "./MyCircleClient";
import { loadCirclePage } from "@/lib/circle-page";

export const metadata: Metadata = { title: "Mi Círculo" };

// "Generar ahora" puede esperar a un modelo free lento (hasta ~20s). Damos
// margen para que la server action no corte antes de tiempo.
export const maxDuration = 60;

export default async function NewsletterPage() {
  const { props } = await loadCirclePage();
  return <MyCircleClient {...props} />;
}
