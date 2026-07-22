import { NextRequest } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { getTodayPlan, reprogramarVencidos } from "@/lib/db/study-system";
import { sendPushToUser } from "@/lib/push/send";
import { sendText } from "@/lib/whatsapp/kapso";
import { nowArgParts } from "@/lib/timezone";

// Plan de estudio diario del dueño. Se dispara con un pinger externo
// (ej. cron-job.org) apuntando acá con Authorization: Bearer <CRON_SECRET>.
// Por defecto SOLO envía cuando la hora ARG coincide con STUDY_PLAN_HOUR (8),
// así se puede pinguear cada hora sin spamear. Forzar con ?force=1.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return bearerMatches(req.headers.get("authorization"), secret);
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return Response.json({ error: "ADMIN_EMAIL no configurado" }, { status: 500 });

  const force = req.nextUrl.searchParams.get("force") === "1";
  const targetHour = parseInt(process.env.STUDY_PLAN_HOUR ?? "8", 10);
  const { hour } = nowArgParts();
  if (!force && hour !== targetHour) {
    return Response.json({ skipped: true, reason: `hora ARG ${hour} != ${targetHour}` });
  }

  const owner = await prisma.profile.findFirst({
    where: { email: adminEmail },
    select: { id: true, whatsappNumber: true },
  });
  if (!owner) return Response.json({ error: "Dueño no encontrado" }, { status: 404 });

  // 1) reprogramar lo vencido para que nada quede sin fecha
  const reprogrammed = await reprogramarVencidos(owner.id).catch(() => 0);

  // 2) armar el plan de hoy
  const plan = await getTodayPlan(owner.id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://controlio.site";
  const planUrl = `${appUrl}/estudio`;

  let body: string;
  if (plan.isRestDay) {
    body = "Hoy es día de descanso 😴 Nada pendiente. Si querés adelantar algo, entrá a Estudio.";
  } else if (plan.items.length === 0) {
    body = "No tenés repasos para hoy 🎉 Vas al día. Podés cargar temas nuevos en Estudio.";
  } else {
    const top = plan.items.slice(0, 5).map((it, i) => `${i + 1}. ${it.subjectCode} — ${it.topic} (~${it.reviewDuration}′)`);
    const extra = plan.items.length > 5 ? `\n…y ${plan.items.length - 5} más` : "";
    body = `📚 Plan de hoy (${plan.items.length} bloques · ~${plan.totalMin} min):\n${top.join("\n")}${extra}`;
  }

  // 3) push
  const pushed = await sendPushToUser(owner.id, {
    title: plan.isRestDay ? "Día de descanso 😴" : "Tu plan de estudio de hoy 📚",
    body: plan.isRestDay || plan.items.length === 0 ? body : `${plan.items.length} bloques · ~${plan.totalMin} min. Tocá para ver el detalle.`,
    url: planUrl,
  }).catch(() => 0);

  // 4) WhatsApp (si tiene número vinculado)
  let wa = false;
  if (owner.whatsappNumber && !plan.isRestDay && plan.items.length > 0) {
    await sendText(owner.whatsappNumber, `${body}\n\nAbrí el detalle: ${planUrl}`).then(() => { wa = true; }).catch(() => {});
  }

  return Response.json({
    ok: true,
    reprogrammed,
    items: plan.items.length,
    totalMin: plan.totalMin,
    restDay: plan.isRestDay,
    pushed,
    whatsapp: wa,
  });
}
