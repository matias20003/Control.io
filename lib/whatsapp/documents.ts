import "server-only";

const MAX_PDF_PAGES = 20;
const MAX_TEXT_CHARS = 24_000;

export async function extractFinancialPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const info = await parser.getInfo();
    if ((info.total ?? 0) > MAX_PDF_PAGES) {
      throw new Error(`El PDF tiene más de ${MAX_PDF_PAGES} páginas`);
    }
    const result = await parser.getText();
    const text = (result.text ?? "").replace(/\u0000/g, "").trim();
    if (!text) throw new Error("El PDF no contiene texto legible");
    return text.slice(0, MAX_TEXT_CHARS);
  } finally {
    await parser.destroy().catch(() => {});
  }
}
