import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MyCircleClient, type CircleSection } from "@/app/(dashboard)/newsletter/MyCircleClient";
import { loadCirclePage } from "@/lib/circle-page";

export const maxDuration = 60;

/**
 * El slug de la URL y la sección interna se escriben distinto a propósito: la
 * URL habla en castellano ("noticias", "ajustes") y el estado usa los nombres
 * que ya tenía la pantalla. Mapear acá evita renombrar diez lugares adentro.
 */
const SECTIONS: Record<string, { section: CircleSection; title: string }> = {
  cercanos:   { section: "cercanos",   title: "Cercanos" },
  referentes: { section: "referentes", title: "Referentes" },
  norte:      { section: "norte",      title: "El Norte" },
  cosecha:    { section: "cosecha",    title: "La Cosecha" },
  espejo:     { section: "espejo",     title: "El Espejo" },
  mudanza:    { section: "mudanza",    title: "La Mudanza" },
  radar:      { section: "radar",      title: "Radar" },
  noticias:   { section: "news",       title: "Noticias" },
  ajustes:    { section: "settings",   title: "Ajustes de Mi Círculo" },
};

export async function generateMetadata({ params }: { params: Promise<{ seccion: string }> }): Promise<Metadata> {
  const { seccion } = await params;
  return { title: SECTIONS[seccion]?.title ?? "Mi Círculo" };
}

export default async function CirculoSeccionPage({ params }: { params: Promise<{ seccion: string }> }) {
  const { seccion } = await params;
  const match = SECTIONS[seccion];
  if (!match) notFound();

  const { isOwner, props } = await loadCirclePage();
  if (!isOwner) redirect("/newsletter");
  return <MyCircleClient {...props} initialSection={match.section} syncUrl />;
}
