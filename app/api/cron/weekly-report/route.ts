import { NextRequest } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { deliverDuePeriodicReports } from "@/lib/reports/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && bearerMatches(req.headers.get("authorization"), secret);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await deliverDuePeriodicReports();
  return Response.json({ ok: true, ...result });
}
