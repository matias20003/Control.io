import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestStudyPdf, ingestStudyText, ingestStudyImage } from "@/lib/study/ingest";
import { rateLimitKey, rateLimitMessage } from "@/lib/rate-limit";

// Solo dueño: sube un apunte (PDF o texto) → resumen IA + repaso espaciado.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  // Cada subida cuesta una llamada a la IA. El límite queda puesto para el día
  // que la sección se abra: sin él, una cuenta sola dispara la factura.
  const limit = await rateLimitKey(`estudio-upload:${user.id}`, 20, 3600);
  if (!limit.success) {
    return Response.json({ error: rateLimitMessage(limit.retryAfterSec) }, { status: 429 });
  }

  try {
    const form = await req.formData();
    const subject = (form.get("subject") as string) || undefined;
    const file = form.get("file");
    const text = (form.get("text") as string) || "";

    if (file && typeof file !== "string") {
      const type = (file as File).type || "";
      const buf = Buffer.from(await file.arrayBuffer());

      // Imagen (foto/captura de la nota, ideal para manuscrito) → visión.
      if (type.startsWith("image/")) {
        const dataUrl = `data:${type};base64,${buf.toString("base64")}`;
        const r = await ingestStudyImage(user.id, [dataUrl], subject);
        if (!r.ok) return Response.json({ error: "No pude leer la imagen. Probá con una foto más nítida." }, { status: 400 });
        return Response.json({ ok: true, subject: r.subject, title: r.title });
      }

      // PDF con texto seleccionable → extracción directa.
      const r = await ingestStudyPdf(user.id, buf, subject);
      if (!r.ok) {
        return Response.json(
          {
            error:
              r.reason === "empty"
                ? "Ese PDF es manuscrito (imagen), no tiene texto. Subilo como FOTO/imagen y te leo la letra 📸"
                : "Error procesando el PDF.",
          },
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
