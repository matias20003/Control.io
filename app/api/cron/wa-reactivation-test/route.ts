import { NextRequest } from "next/server";
import { sendText } from "@/lib/whatsapp/kapso";

// Prueba (auth por CRON_SECRET): manda UN mensaje de reactivación por WhatsApp al
// número ?to=<...> y devuelve el resultado/exacto error de Kapso. Sirve para saber
// si podemos reactivar por WhatsApp a usuarios dormidos (fuera de ventana 24h) o si
// Meta lo rechaza y hace falta plantilla.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const MSG =
  "👋 ¡Hola! Te escribimos de control.io. Hace un tiempo que no pasás — tus cuentas, " +
  "movimientos y números te esperan. Entrá y ponete al día en un toque 👉 https://controlio.site/dashboard";

export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const to = req.nextUrl.searchParams.get("to");
  if (!to) return Response.json({ error: "falta ?to=<numero>" }, { status: 400 });

  try {
    await sendText(to, MSG);
    return Response.json({ ok: true, sent: true, to });
  } catch (e) {
    // sendText lanza con el body de error de Kapso/Meta → lo devolvemos crudo.
    return Response.json({ ok: false, sent: false, to, error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
}
