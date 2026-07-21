import { NextRequest } from "next/server";
import { sendReactivationNudges } from "@/lib/reactivation";

// Vercel Cron diario: nudge a usuarios que se registraron y NO cargaron ningún
// movimiento, para llevarlos a su primer "aha". La lógica vive en lib/reactivation
// (compartida con el botón "Enviar ahora" del admin).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Auth exigida en todo ambiente (sin atajo por NODE_ENV).
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendReactivationNudges();
  return Response.json({ ok: true, ...result });
}
