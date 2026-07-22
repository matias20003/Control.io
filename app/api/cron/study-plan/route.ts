import { NextRequest } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { fireDailyStudyPlan, sendDailyStudyPlan } from "@/lib/study/notify";

// Plan de estudio diario. El envío automático a la hora configurada corre
// enganchado al cron de recordatorios (cada minuto). Este endpoint queda para
// disparo manual/prueba: ?force=1 manda el plan ahora mismo ignorando la hora.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return bearerMatches(req.headers.get("authorization"), secret);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!force) {
    const r = await fireDailyStudyPlan();
    return Response.json({ ok: true, ...r });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return Response.json({ error: "ADMIN_EMAIL no configurado" }, { status: 500 });
  const owner = await prisma.profile.findFirst({ where: { email: adminEmail }, select: { id: true, whatsappNumber: true } });
  if (!owner) return Response.json({ error: "Dueño no encontrado" }, { status: 404 });

  const res = await sendDailyStudyPlan(owner.id, owner.whatsappNumber);
  return Response.json({ ok: true, forced: true, ...res });
}
