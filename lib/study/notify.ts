import "server-only";
import { prisma } from "@/lib/prisma";
import { getTodayPlan, reprogramarVencidos } from "@/lib/db/study-system";
import { sendPushToUser } from "@/lib/push/send";
import { sendText } from "@/lib/whatsapp/kapso";
import { nowArgParts, todayStringArg } from "@/lib/timezone";

export type StudySettingsDTO = {
  planHour: number;
  planMinute: number;
  notifyEnabled: boolean;
  lastPlanSent: string | null;
};

const DEFAULTS: StudySettingsDTO = { planHour: 8, planMinute: 0, notifyEnabled: true, lastPlanSent: null };

export async function getStudySettings(userId: string): Promise<StudySettingsDTO> {
  const row = await prisma.studySettings.findUnique({ where: { userId } });
  if (!row) return { ...DEFAULTS };
  return { planHour: row.planHour, planMinute: row.planMinute, notifyEnabled: row.notifyEnabled, lastPlanSent: row.lastPlanSent };
}

export async function setStudySettings(
  userId: string,
  input: { planHour: number; planMinute: number; notifyEnabled: boolean }
): Promise<void> {
  await prisma.studySettings.upsert({
    where: { userId },
    create: { userId, planHour: input.planHour, planMinute: input.planMinute, notifyEnabled: input.notifyEnabled },
    update: { planHour: input.planHour, planMinute: input.planMinute, notifyEnabled: input.notifyEnabled },
  });
}

function planUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://controlio.site";
  return `${appUrl}/estudio`;
}

/** Texto del plan de hoy para WhatsApp (formato lindo, priorizado). */
export function buildPlanText(plan: Awaited<ReturnType<typeof getTodayPlan>>): string {
  if (plan.isRestDay) return "😴 Hoy es día de descanso. Nada pendiente. Si querés adelantar algo, entrá a Estudio.";
  if (plan.items.length === 0) return "🎉 No tenés repasos para hoy, vas al día. Podés cargar temas nuevos en Estudio.";
  const lines = plan.items.map((it, i) => {
    const err = it.lastError ? `\n   ⚠️ A reforzar: ${it.lastError}` : "";
    return `${i + 1}. *${it.subjectCode}* — ${it.topic} (~${it.reviewDuration}′)\n   ${it.activity}${err}`;
  });
  return `📚 *Plan de estudio de hoy*\n${plan.items.length} bloque(s) · ~${plan.totalMin} min\n\n${lines.join("\n\n")}`;
}

/**
 * Reprograma lo vencido, arma el plan de hoy y lo manda por push + WhatsApp.
 * Devuelve un resumen de lo enviado.
 */
export async function sendDailyStudyPlan(
  userId: string,
  whatsappNumber?: string | null
): Promise<{ items: number; totalMin: number; restDay: boolean; pushed: number; whatsapp: boolean; reprogrammed: number }> {
  const reprogrammed = await reprogramarVencidos(userId).catch(() => 0);
  const plan = await getTodayPlan(userId);

  const pushBody = plan.isRestDay
    ? "Día de descanso 😴 Nada pendiente hoy."
    : plan.items.length === 0
      ? "Vas al día 🎉 Sin repasos para hoy."
      : `${plan.items.length} bloques · ~${plan.totalMin} min. Tocá para ver el detalle.`;

  const pushed = await sendPushToUser(userId, {
    title: plan.isRestDay ? "Día de descanso 😴" : "Tu plan de estudio de hoy 📚",
    body: pushBody,
    url: planUrl(),
  }).catch(() => 0);

  let whatsapp = false;
  if (whatsappNumber && !plan.isRestDay && plan.items.length > 0) {
    await sendText(whatsappNumber, `${buildPlanText(plan)}\n\nAbrir: ${planUrl()}`)
      .then(() => { whatsapp = true; })
      .catch(() => {});
  }

  return { items: plan.items.length, totalMin: plan.totalMin, restDay: plan.isRestDay, pushed: pushed ?? 0, whatsapp, reprogrammed };
}

/**
 * Best-effort para el cron por minuto: si llegó la hora configurada del dueño y
 * hoy todavía no se mandó, envía el plan y marca la fecha. Idempotente por día.
 */
export async function fireDailyStudyPlan(): Promise<{ sent: boolean; reason?: string }> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { sent: false, reason: "no-admin" };

  const owner = await prisma.profile.findFirst({ where: { email: adminEmail }, select: { id: true, whatsappNumber: true } });
  if (!owner) return { sent: false, reason: "no-owner" };

  const settings = await getStudySettings(owner.id);
  if (!settings.notifyEnabled) return { sent: false, reason: "disabled" };

  const today = todayStringArg();
  if (settings.lastPlanSent === today) return { sent: false, reason: "already-sent" };

  const { hour, minute } = nowArgParts();
  if (hour * 60 + minute < settings.planHour * 60 + settings.planMinute) return { sent: false, reason: "too-early" };

  await sendDailyStudyPlan(owner.id, owner.whatsappNumber);
  await prisma.studySettings.upsert({
    where: { userId: owner.id },
    create: { userId: owner.id, planHour: settings.planHour, planMinute: settings.planMinute, notifyEnabled: true, lastPlanSent: today },
    update: { lastPlanSent: today },
  });
  return { sent: true };
}
