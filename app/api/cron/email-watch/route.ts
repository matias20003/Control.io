import { NextRequest } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { watchUtnEmails } from "@/lib/email/utn-watch";

// Vigilante de correos de la UTN: revisa la bandeja del dueño y avisa por
// WhatsApp + push si llegó un correo de la facultad. Se puede pingear con un
// cron externo (ej. cron-job.org) cada 15-30 min; además corre solo, colgado
// del cron horario del newsletter.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !bearerMatches(req.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await watchUtnEmails();
  return Response.json({ ok: true, ...result });
}
