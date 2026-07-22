import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildStudyIcs } from "@/lib/study/ics";

// Feed de calendario (.ics) suscribible. La autorización es el token secreto de
// la URL (los clientes de calendario no mandan headers), así que el token debe
// ser largo e imposible de adivinar. Solo lectura de fechas de estudio.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  if (token.length < 24) return new Response("Not found", { status: 404 });

  const row = await prisma.studySettings.findFirst({ where: { icsToken: token }, select: { userId: true } });
  if (!row) return new Response("Not found", { status: 404 });

  const ics = await buildStudyIcs(row.userId);
  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="estudio.ics"',
      "Cache-Control": "public, max-age=1800",
    },
  });
}
