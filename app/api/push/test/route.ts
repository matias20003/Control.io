import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/send";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title: string = body.title ?? "🔔 Notificación de prueba";
  const message: string = body.body ?? "control.io está funcionando correctamente.";

  try {
    await sendPushToUser(user.id, {
      title,
      body: message,
      url: "/dashboard",
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Error al enviar la notificación" }, { status: 500 });
  }
}
