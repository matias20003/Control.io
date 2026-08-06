import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrganization } from "@/lib/db/organization";
import { getAgenda } from "@/lib/db/agenda";
import { getGoogleStatus } from "@/lib/google";
import { ensureCalendarWatch, syncGoogleOrganizationIfStale } from "@/lib/google-organization";
import { getStudyToday } from "@/lib/db/study-career";

/**
 * Los datos que comparten las cuatro secciones de Organización (Hoy, Calendario,
 * Tareas, Hábitos). Son la misma foto vista de cuatro maneras: una tarea sin
 * día aparece en Tareas y en la bandeja del Calendario, y el hábito de hoy se
 * marca desde Hoy o desde Hábitos. Cargarlas por separado las desincronizaría.
 */
export async function loadOrganizationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const isOwner = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;

  const google = await getGoogleStatus(user.id).catch(() => ({ connected: false, email: null }));
  if (google.connected) {
    // Con throttle: sin esto, cada router.refresh() del cliente (o sea, cada
    // tarea que se marca) bloqueaba el render con dos llamadas a Google.
    await syncGoogleOrganizationIfStale(user.id).catch(() => null);
    await ensureCalendarWatch(user.id).catch(() => null);
  }

  const [initial, financeEvents] = await Promise.all([
    getOrganization(user.id),
    getAgenda(user.id, 60).catch(() => []),
  ]);

  return { initial, financeEvents, googleConnected: google.connected, isOwner };
}

/**
 * Las secciones separadas (Hoy, Tareas, Hábitos) son parte del rediseño en
 * prueba. Quien no lo tiene activo sigue entrando por la pantalla única, así
 * que llegar a estas rutas de casualidad lo devuelve ahí en vez de mostrarle
 * media función suelta.
 */
export async function requireOwnerOrCalendar() {
  const { isOwner, ...data } = await loadOrganizationPage();
  if (!isOwner) redirect("/calendario");
  return data;
}

/**
 * Lo mismo, más lo que toca estudiar hoy.
 *
 * El plan del parcial vive en su propia sección, pero el día se mira en Hoy: si
 * el material no aparece ahí, la persona tiene que acordarse de ir a buscarlo,
 * que es exactamente la clase de trabajo que hace abandonar un plan.
 */
export async function loadDayWithStudy(day: string) {
  const data = await requireOwnerOrCalendar();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const study = user ? await getStudyToday(user.id, day).catch(() => []) : [];
  return { ...data, study };
}

/**
 * El día que la pantalla tiene que mostrar, tomado de `?d=`. Lo usa el
 * calendario mensual para saltar a Hoy en la fecha elegida sin perderla.
 */
export function dayFromParams(params: { d?: string | string[] } | undefined): string | undefined {
  const raw = Array.isArray(params?.d) ? params.d[0] : params?.d;
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}
