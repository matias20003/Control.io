import { createClient } from "@/lib/supabase/server";
import { fetchRecentEmails } from "@/lib/email/imap";
import { classifyEmails } from "@/lib/email/classify";

// Admin-only: bandeja unificada. Trae los últimos correos por IMAP (App Password)
// y los clasifica con IA (categoría + prioridad). Sin OAuth ni verificación de
// Google — es la casilla del dueño.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const emails = await fetchRecentEmails(25);
    const cls = await classifyEmails(emails.map((e) => ({ from: e.from, subject: e.subject })));
    const merged = emails.map((e, i) => ({ ...e, ...cls[i] }));
    return Response.json({ ok: true, account: process.env.GMAIL_IMAP_USER ?? "", emails: merged });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer la bandeja";
    return Response.json({ error: msg }, { status: 500 });
  }
}
