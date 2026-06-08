/**
 * Cliente para Kapso (plataforma gestionada de WhatsApp sobre la Cloud API).
 *
 * Variables de entorno:
 *   KAPSO_API_KEY          → Project API Key (header X-API-Key)
 *   KAPSO_PHONE_NUMBER_ID  → id del número conectado (va en la URL de envío)
 *   KAPSO_WEBHOOK_SECRET   → Secret Key para verificar la firma del webhook
 *   KAPSO_API_URL          → opcional, default https://api.kapso.ai
 */
import crypto from "node:crypto";

function apiUrl(): string {
  return (process.env.KAPSO_API_URL ?? "https://api.kapso.ai").replace(/\/+$/, "");
}

/** Envía un mensaje de texto por WhatsApp a través de Kapso. */
export async function sendText(to: string, text: string): Promise<void> {
  const apiKey = process.env.KAPSO_API_KEY;
  if (!apiKey) throw new Error("KAPSO_API_KEY no configurada");
  const phoneId = process.env.KAPSO_PHONE_NUMBER_ID;
  if (!phoneId) throw new Error("KAPSO_PHONE_NUMBER_ID no configurada");

  const res = await fetch(`${apiUrl()}/meta/whatsapp/v24.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kapso sendText falló (${res.status}): ${body}`);
  }
}

/**
 * Marca el mensaje como leído y muestra "escribiendo..." al usuario.
 * Da feedback instantáneo mientras procesamos (la IA tarda unos segundos).
 * Best-effort: si falla, no rompe el flujo.
 */
export async function markReadAndType(messageId: string): Promise<void> {
  const apiKey = process.env.KAPSO_API_KEY;
  const phoneId = process.env.KAPSO_PHONE_NUMBER_ID;
  if (!apiKey || !phoneId || !messageId) return;
  try {
    await fetch(`${apiUrl()}/meta/whatsapp/v24.0/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        typing_indicator: { type: "text" },
      }),
    });
  } catch {
    // best-effort
  }
}

/**
 * Verifica la firma HMAC-SHA256 del webhook de Kapso.
 * Si no hay KAPSO_WEBHOOK_SECRET configurado, no bloquea (modo dev).
 */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.KAPSO_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;

  const received = signature.replace(/^sha256=/, "").trim();
  const hmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8");
  const expectedHex = hmac.digest("hex");
  const expectedB64 = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  return received === expectedHex || received === expectedB64;
}
