import { NextRequest } from "next/server";
import { generateAllEditions } from "@/lib/services/newsletter";

// Endpoint de generación del newsletter para todos los usuarios activos.
// NO está registrado como cron en vercel.json (Vercel Hobby permite solo 2):
// el disparo diario se consolida dentro de /api/cron/recurring. Este endpoint
// queda para dispararlo manualmente o desde un scheduler externo.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (process.env.NODE_ENV !== "production") return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await generateAllEditions();
  return Response.json({ ok: true, ...result });
}
