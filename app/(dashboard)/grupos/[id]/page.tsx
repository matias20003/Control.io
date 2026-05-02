import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getGrupoDetalle } from "@/lib/db/grupos";
import { GrupoDetalleClient } from "./GrupoDetalleClient";

export const metadata: Metadata = { title: "Detalle del grupo" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GrupoDetallePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const grupo = await getGrupoDetalle(id, user.id);
  if (!grupo) notFound();

  return <GrupoDetalleClient grupo={grupo} currentUserId={user.id} />;
}
