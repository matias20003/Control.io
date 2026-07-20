import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendText, markReadAndType, fetchMediaAsDataUrl, verifySignature } from "@/lib/whatsapp/kapso";
import { findProfileByPhone } from "@/lib/whatsapp/users";
import { linkWhatsappByCode } from "@/lib/db/profile";
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
  let claimedId: string | null = null; // id que reservamos en processed_messages
  let processed = false;                // true una vez que el mensaje YA se procesó

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
      claimedId = message.id; // reservado; se libera si fallamos antes de procesar
    }

    const profile = await findProfileByPhone(from);
    if (!profile) {
      // Vinculación en 1 toque: si el mensaje es "Vincular <code>", lo linkeamos
      // capturando su número real (cero tipeo, imposible equivocarse de dígito).
      const linkMatch = (getText(message) ?? "").match(/vincular[:\s-]+([a-z0-9]{6,16})/i);
      if (linkMatch) {
        const linked = await linkWhatsappByCode(linkMatch[1].toLowerCase(), from);
        if (linked) {
          await sendText(
            from,
            `¡Listo${linked.name ? `, ${linked.name.split(" ")[0]}` : ""}! 🎉 Tu WhatsApp quedó vinculado a control.io.\n\n` +
            `Ahora probá cargar tu primer gasto: escribime *"gasté 3000 en el súper"*, mandame un *audio* o la *foto de un ticket*. Yo lo registro solo 👍`
          );
          return Response.json({ ok: true, linked: true });
        }
        await sendText(from, "Ese código de vinculación no es válido o venció 🤔 Entrá a controlio.site y tocá *Vincular WhatsApp* de nuevo para obtener uno fresco.");
        return Response.json({ ok: true, linked: false, badCode: true });
      }

      // Registramos el número entrante (best-effort) para diagnosticar si un
      // número YA vinculado falla el matcheo, vs un tester que no vinculó.
      try {
        const tail = from.replace(/\D/g, "").slice(-10);
        await prisma.$executeRaw`INSERT INTO "whatsapp_unmatched" (from_raw, tail) VALUES (${from}, ${tail})`;
      } catch {
        // no debe romper el flujo
      }
      await sendText(
        from,
        "👋 Tu número todavía no está vinculado a ninguna cuenta.\n\nEntrá a controlio.site, tocá *Vincular WhatsApp* en el inicio y se abre este chat con un código listo — con un toque quedás vinculado."
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

    // A partir de acá el mensaje YA se procesó (puede haber creado un
    // movimiento). No liberamos el claim ni reintentamos aunque falle el envío
    // de la respuesta — reprocesarlo duplicaría el gasto.
    processed = true;
    try {
      await sendText(from, reply);
    } catch (err) {
      console.error("[kapso webhook] no pude enviar la respuesta:", err);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[kapso webhook] error:", err);

    // Si fallamos ANTES de procesar, liberamos el claim para que el reintento de
    // Kapso vuelva a procesar el mensaje (en vez de perderlo en silencio).
    if (claimedId && !processed) {
      await prisma
        .$executeRaw`DELETE FROM "whatsapp_processed_messages" WHERE id = ${claimedId}`
        .catch(() => {});
    }

    if (from && !processed) {
      try {
        await sendText(from, "⚠️ Uy, tuve un problema procesando tu mensaje. Probá de nuevo en un momento.");
      } catch {
        // ignore
      }
    }

    // 500 si no llegamos a procesar → Kapso reintenta y no se pierde el mensaje.
    // Si ya procesamos, 200 para no reprocesar (evita duplicar el movimiento).
    return Response.json({ ok: processed }, { status: processed ? 200 : 500 });
  }
}

// Kapso/Meta pueden validar el endpoint con un GET.
export async function GET() {
  return Response.json({ ok: true, service: "control.io kapso webhook" });
}
