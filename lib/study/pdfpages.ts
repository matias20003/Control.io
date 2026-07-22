import "server-only";

// Rasteriza páginas de un PDF a imágenes (data URL) usando mupdf (WASM, sin
// dependencias nativas). Sirve para leer cuadernos manuscritos página por página.

const DPI = 132; // legible para manuscrito sin inflar demasiado el payload

export async function pdfPageCount(buffer: Buffer): Promise<number> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(new Uint8Array(buffer), "application/pdf");
  return doc.countPages();
}

/**
 * Rasteriza las páginas [from, to) (0-indexadas) a data URLs PNG.
 * `to` exclusivo; se acota al total real.
 */
export async function renderPdfPages(buffer: Buffer, from: number, to: number): Promise<string[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(new Uint8Array(buffer), "application/pdf");
  const total = doc.countPages();
  const start = Math.max(0, from);
  const end = Math.min(to, total);
  const scale = DPI / 72;
  const mat = mupdf.Matrix.scale(scale, scale);

  const out: string[] = [];
  for (let i = start; i < end; i++) {
    const page = doc.loadPage(i);
    const pix = page.toPixmap(mat, mupdf.ColorSpace.DeviceRGB, false);
    const png = pix.asPNG();
    out.push(`data:image/png;base64,${Buffer.from(png).toString("base64")}`);
  }
  return out;
}
