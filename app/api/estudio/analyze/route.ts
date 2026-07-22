import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeTextToBlocks, analyzeImagesToBlocks } from "@/lib/study/analyze";
import { extractPdfText } from "@/lib/study/ingest";

// Solo dueño: sube material (texto, PDF o foto) y la IA lo DIVIDE en bloques
// propuestos (no los guarda; el cliente los revisa y confirma).
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const hint = (form.get("subject") as string) || undefined;
    const files = form.getAll("file").filter((f): f is File => typeof f !== "string");
    const text = (form.get("text") as string) || "";

    if (files.length) {
      const images = files.filter((f) => (f.type || "").startsWith("image/")).slice(0, 10);

      // Varias fotos (páginas de una clase) → una sola división en bloques.
      if (images.length) {
        const dataUrls = await Promise.all(
          images.map(async (f) => `data:${f.type};base64,${Buffer.from(await f.arrayBuffer()).toString("base64")}`)
        );
        const r = await analyzeImagesToBlocks(dataUrls, hint);
        if (!r.blocks.length) return Response.json({ error: "No pude leer las imágenes. Probá con fotos más nítidas." }, { status: 400 });
        return Response.json({ ok: true, unit: r.unit, blocks: r.blocks });
      }

      // PDF: intento texto; si es manuscrito (sin texto), pido que sea foto.
      const buf = Buffer.from(await files[0].arrayBuffer());
      const pdfText = await extractPdfText(buf).catch(() => "");
      if (pdfText.trim().length >= 40) {
        const r = await analyzeTextToBlocks(pdfText, hint);
        if (!r.blocks.length) return Response.json({ error: "No pude dividir el PDF." }, { status: 400 });
        return Response.json({ ok: true, unit: r.unit, blocks: r.blocks });
      }
      return Response.json(
        { error: "Ese PDF es manuscrito (imagen). Subilo como FOTOS y te leo la letra 📸" },
        { status: 400 }
      );
    }

    if (text.trim().length >= 40) {
      const r = await analyzeTextToBlocks(text.trim(), hint);
      if (!r.blocks.length) return Response.json({ error: "No pude dividir el material." }, { status: 400 });
      return Response.json({ ok: true, unit: r.unit, blocks: r.blocks });
    }

    return Response.json({ error: "Pegá el texto o subí un PDF/foto del material." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
