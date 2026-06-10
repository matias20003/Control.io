import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendText, markReadAndType, fetchMediaAsDataUrl, verifySignature } from "@/lib/whatsapp/kapso";
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
  image?: { id?: string; mime_type?: string; caption?: string };
  kapso?: {
    direction?: string;
    content?: string;
    has_media?: boolean;
    media_url?: string;
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
  if (message.image?.caption) return message.image.caption;
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

    // Idempotencia: Kapso reintenta el webhook si tardamos en responder. Si ya
    // procesamos este mensaje, no lo volvemos a cargar (evita duplicados).
    if (message.id) {
      const inserted = await prisma.$executeRaw`
        INSERT INTO "whatsapp_processed_messages" (id) VALUES (${message.id})
        ON CONFLICT (id) DO NOTHING`;
      if (inserted === 0) return Response.json({ ok: true, duplicate: true });
    }

    const profile = await findProfileByPhone(from);
    if (!profile) {
      await sendText(
        from,
        "👋 Tu número todavía no está vinculado a ninguna cuenta.\n\nIniciá sesión en controlio.site, andá a *Configuración → Perfil* y agregá este número de WhatsApp para empezar a registrar tus gastos por acá."
      );
      return Response.json({ ok: true, linked: false });
    }

    // Feedback inmediato: marca leído + "escribiendo..." mientras procesamos.
    if (message.id) void markReadAndType(message.id);

    // Si mandó una imagen (ticket, recibo, captura), la descargamos para que la lea la IA.
    let imageUrl: string | undefined;
    if (message.type === "image" && message.kapso?.media_url) {
      try {
        imageUrl = await fetchMediaAsDataUrl(message.kapso.media_url, message.image?.mime_type);
      } catch (err) {
        console.error("[kapso webhook] no pude descargar la imagen:", err);
      }
    }

    const text = getText(message);
    if (!text && !imageUrl) {
      const isAudio = message.type === "audio" || message.kapso?.has_media;
      await sendText(
        from,
        isAudio
          ? "No pude entender el audio 🙉 Probá de nuevo hablando más claro o escribime el gasto."
          : "Entiendo texto, audios y fotos 🙂 Mandame el gasto o ingreso de alguna de esas formas."
      );
      return Response.json({ ok: true, unsupported: true });
    }

    const reply = await handleUserMessage(profile.id, text ?? "", imageUrl);
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
