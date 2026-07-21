import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestStudyPdf, ingestStudyText } from "@/lib/study/ingest";

// Solo dueño: sube un apunte (PDF o texto) → resumen IA + repaso espaciado.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const subject = (form.get("subject") as string) || undefined;
    const file = form.get("file");
    const text = (form.get("text") as string) || "";

    if (file && typeof file !== "string") {
      const buf = Buffer.from(await file.arrayBuffer());
      const r = await ingestStudyPdf(user.id, buf, subject);
      if (!r.ok) {
        return Response.json(
          { error: r.reason === "empty" ? "No pude leer texto del PDF (¿es escaneado?)." : "Error procesando el PDF." },
          { status: 400 }
        );
      }
      return Response.json({ ok: true, subject: r.subject, title: r.title });
    }

    if (text.trim().length > 20) {
      const r = await ingestStudyText(user.id, text.trim(), subject);
      if (!r.ok) return Response.json({ error: "No pude guardar el apunte." }, { status: 400 });
      return Response.json({ ok: true, subject: r.subject, title: r.title });
    }

    return Response.json({ error: "Subí un PDF o pegá el texto del apunte." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
