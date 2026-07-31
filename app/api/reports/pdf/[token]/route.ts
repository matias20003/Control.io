import { prisma } from "@/lib/prisma";
import { renderPeriodicReportPdf } from "@/lib/reports/pdf";
import type { PeriodicReportSnapshot } from "@/lib/reports/periodic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
