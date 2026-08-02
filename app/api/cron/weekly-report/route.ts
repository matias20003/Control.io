import { NextRequest } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { fireReportDeliveries } from "@/lib/reports/dispatch";

/**
 * Disparo manual de los reportes periódicos.
 *
 * La entrega automática NO depende de esta ruta: vive en lib/reports/dispatch y
 * la llama el cron de recordatorios, que es el único que corre siempre. Esta
 * ruta queda para poder forzar una corrida y para diagnosticar.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && bearerMatches(req.headers.get("authorization"), secret);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await fireReportDeliveries();
  return Response.json({ ok: true, ...result });
}
