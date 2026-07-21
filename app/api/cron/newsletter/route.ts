import { NextRequest } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { generateEditionsForHour } from "@/lib/services/newsletter";
import { watchUtnEmails } from "@/lib/email/utn-watch";
import { nowArgParts } from "@/lib/timezone";

// Generación horaria del newsletter. NO está en vercel.json (Vercel Hobby
// permite solo 2 crons y ya están usados): se dispara con un pinger externo
// gratuito (ej. cron-job.org) apuntando acá CADA HORA con el header
//   Authorization: Bearer <CRON_SECRET>
// En cada corrida genera SOLO para los usuarios cuyo `sendHour` (hora ARG)
// coincide con la hora actual, y les avisa por push + WhatsApp.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Auth exigida en todo ambiente (sin atajo por NODE_ENV).
  return bearerMatches(req.headers.get("authorization"), secret);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Permite forzar una hora puntual con ?hour=8 (útil para pruebas manuales).
  const hourParam = req.nextUrl.searchParams.get("hour");
  const parsed = hourParam != null ? parseInt(hourParam, 10) : NaN;
  const hour =
    Number.isInteger(parsed) && parsed >= 0 && parsed <= 23
      ? parsed
      : nowArgParts().hour;

  const result = await generateEditionsForHour(hour);

  // Colgado acá (best-effort): vigilante de correos de la UTN. Corre cada vez que
  // se pinga el newsletter (horario), sin necesitar un cron aparte.
  const utnWatch = await watchUtnEmails().catch(() => ({ notified: 0, skipped: 0 }));

  return Response.json({ ok: true, hour, ...result, utnWatch });
}
