import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { analyzeTextToBlocks, analyzeImagesToBlocks } from "@/lib/study/analyze";
import { extractPdfText } from "@/lib/study/ingest";
import { pdfPageCount, renderPdfPages } from "@/lib/study/pdfpages";

// Solo dueño: sube material (texto, PDF o foto) y la IA lo DIVIDE en bloques
// propuestos (no los guarda; el cliente los revisa y confirma).
export const runtime = "nodejs";
export const maxDuration = 120;

// Cuántas páginas nuevas del cuaderno procesamos por subida (para no pasar el
// límite de tiempo del server). El día a día suele ser menos que esto.
const NOTEBOOK_PAGES_PER_RUN = 6;

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
    const notebook = form.get("notebook") === "1";
    const skipBacklog = form.get("skip") === "1";
    const subjectId = (form.get("subjectId") as string) || "";
    const fromPageRaw = parseInt((form.get("fromPage") as string) || "", 10); // 1-indexado, opcional

    // ── MODO CUADERNO: PDF manuscrito completo, procesar SOLO páginas nuevas ──
    if (notebook && subjectId && files.length) {
      const subject = await prisma.studySubject.findFirst({
        where: { id: subjectId, userId: user.id },
        select: { id: true, code: true, notebookPages: true },
      });
      if (!subject) return Response.json({ error: "Materia no encontrada" }, { status: 404 });

      const buf = Buffer.from(await files[0].arrayBuffer());
      let total: number;
      try {
        total = await pdfPageCount(buf);
      } catch {
        return Response.json({ error: "No pude abrir el PDF" }, { status: 400 });
      }

      // "Empezar desde acá": marca todo lo actual como ya procesado, sin leer.
      if (skipBacklog) {
        await prisma.studySubject.update({ where: { id: subject.id }, data: { notebookPages: total } });
        return Response.json({ ok: true, notebook: { skipped: true, total } });
      }

      // Rango manual "desde la página X" (1-indexado) tiene prioridad sobre el puntero.
      const manualFrom = Number.isInteger(fromPageRaw) && fromPageRaw >= 1 ? fromPageRaw - 1 : null;
      const from = manualFrom != null ? Math.min(manualFrom, total) : Math.min(subject.notebookPages, total);
      if (from >= total) {
        return Response.json({ ok: true, notebook: { noNew: true, total, processed: from }, blocks: [] });
      }
      const to = Math.min(from + NOTEBOOK_PAGES_PER_RUN, total);
      const dataUrls = await renderPdfPages(buf, from, to);
      const r = await analyzeImagesToBlocks(dataUrls, subject.code);
      return Response.json({
        ok: true,
        unit: r.unit,
        blocks: r.blocks,
        notebook: { from, to, total, remaining: total - to, subjectId: subject.id },
      });
    }

    if (files.length) {
      const images = files.filter((f) => (f.type || "").startsWith("image/")).slice(0, 20);

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
