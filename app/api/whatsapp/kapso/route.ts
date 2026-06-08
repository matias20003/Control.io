import { NextRequest } from "next/server";
import { sendText, verifySignature } from "@/lib/whatsapp/kapso";
import { findProfileByPhone } from "@/lib/whatsapp/users";
import { handleUserMessage } from "@/lib/whatsapp/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type KapsoMessage = {
  id?: string;
  type?: string;
  from?: string;
  text?: { body?: string };
  kapso?: {
    direction?: string;
    content?: string;
    has_media?: boolean;
    transcript?: { text?: string };
  };
};

/** Encuentra el objeto `message` dentro del payload del webhook de Kapso. */
function extractMessage(body: Record<string, unknown>): KapsoMessage | null {
  const data = (body.data ?? body) as Record<string, unknown>;
  if (data.message) return data.message as KapsoMessage;
  if (body.message) return body.message as KapsoMessage;

  // Fallback al formato crudo de Meta (entry → changes → value → messages[])
  const entry = (data.entry ?? (body as Record<string, unknown>).entry) as
    | { changes?: { value?: { messages?: KapsoMessage[] } }[] }[]
    | undefined;
  const msg = entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  return msg ?? null;
}

/** Obtiene el texto del mensaje: texto directo o transcripción del audio. */
function getText(message: KapsoMessage): string | null {
  if (message.text?.body) return message.text.body;
  if (message.kapso?.transcript?.text) return message.kapso.transcript.text;
  if (message.kapso?.content) return message.kapso.content;
  return null;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get("x-webhook-signature"))) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let from: string | null = null;

  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    const event = (body.event as string) ?? req.headers.get("x-webhook-event") ?? "";
    if (event && event !== "whatsapp.message.received") {
      return Response.json({ ok: true, ignored: event });
    }

    const message = extractMessage(body);
    if (!message) return Response.json({ ok: true, ignored: "no-message" });

    // Ignorar mensajes salientes (los que mandamos nosotros)
    if (message.kapso?.direction === "outbound") {
      return Response.json({ ok: true, ignored: "outbound" });
    }

    from = message.from ?? null;
    if (!from) return Response.json({ ok: true, ignored: "no-sender" });

    const profile = await findProfileByPhone(from);
    if (!profile) {
      await sendText(
        from,
        "👋 Tu número no está vinculado a ninguna cuenta de control.io.\n\nIniciá sesión en la app, andá a *Configuración → Perfil* y agregá este número de WhatsApp para empezar a registrar tus gastos por acá."
      );
      return Response.json({ ok: true, linked: false });
    }

    const text = getText(message);
    if (!text) {
      const isAudio = message.type === "audio" || message.kapso?.has_media;
      await sendText(
        from,
        isAudio
          ? "No pude entender el audio 🙉 Probá de nuevo hablando más claro o escribime el gasto."
          : "Por ahora entiendo texto y audios 🙂 Mandame el gasto o ingreso de esa forma."
      );
      return Response.json({ ok: true, unsupported: true });
    }

    const reply = await handleUserMessage(profile.id, text);
    await sendText(from, reply);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[kapso webhook] error:", err);
    if (from) {
      try {
        await sendText(from, "⚠️ Uy, tuve un problema procesando tu mensaje. Probá de nuevo en un momento.");
      } catch {
        // ignore
      }
    }
    // Respondemos 200 para que Kapso no reintente en loop.
    return Response.json({ ok: false });
  }
}

// Kapso/Meta pueden validar el endpoint con un GET.
export async function GET() {
  return Response.json({ ok: true, service: "control.io kapso webhook" });
}
