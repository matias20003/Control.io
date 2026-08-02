import { prisma } from "@/lib/prisma";
import { renderPeriodicReportPdf } from "@/lib/reports/pdf";
import type { PeriodicReportSnapshot } from "@/lib/reports/periodic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El render con pdf-lib es rápido; lo que tarda es el arranque en frío de la
// función más la conexión a la base. Con margen de sobra para que Meta no corte
// la descarga del documento a medio camino.
export const maxDuration = 30;

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[a-f0-9]{48}$/.test(token)) return new Response("No encontrado", { status: 404 });
  const report = await prisma.reportDelivery.findUnique({
    where: { publicToken: token },
    select: { snapshot: true, frequency: true, periodStart: true },
  });
  if (!report) return new Response("No encontrado", { status: 404 });
  const pdf = await renderPeriodicReportPdf(report.snapshot as unknown as PeriodicReportSnapshot);
  const filename = `controlio-reporte-${report.frequency.toLowerCase()}-${report.periodStart.toISOString().slice(0, 10)}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      // El reporte de un token es una foto de un período ya cerrado: no cambia
      // nunca. Con immutable, volver a abrirlo desde el mismo dispositivo es
      // instantáneo en vez de re-renderizar y pagar otro arranque en frío.
      // Sigue siendo private: no se cachea en la CDN compartida.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
