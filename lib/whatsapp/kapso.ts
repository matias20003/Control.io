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

// Hosts permitidos para descargar media (Kapso + CDNs oficiales de WhatsApp/Meta).
// Evita SSRF: el media_url viene del payload del webhook y no debe poder apuntar
// a IPs internas / servicios del propio servidor.
const ALLOWED_MEDIA_HOSTS = [
  /(^|\.)kapso\.ai$/i,
  /(^|\.)whatsapp\.net$/i,
  /(^|\.)fbcdn\.net$/i,
  /(^|\.)fbsbx\.com$/i,
  /(^|\.)cdninstagram\.com$/i,
];
const MAX_MEDIA_BYTES = 15 * 1024 * 1024; // 15 MB

function assertSafeMediaUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("media_url inválida");
  }
  if (u.protocol !== "https:") throw new Error("media_url debe ser https");
  const host = u.hostname.toLowerCase();
  // Rechazar IPs literales y hosts internos (SSRF a metadata / red interna).
  if (
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") ||
    host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")
  ) {
    throw new Error("media_url apunta a un host no permitido");
  }
  if (!ALLOWED_MEDIA_HOSTS.some((re) => re.test(host))) {
    throw new Error(`media_url de host no permitido: ${host}`);
  }
  return u;
}

/**
 * Envía un MENSAJE DE PLANTILLA (HSM) aprobada por Meta. Es la única forma de
 * escribirle a un usuario FUERA de la ventana de 24h (reactivación de dormidos).
 * `bodyParams` llena las variables {{1}}, {{2}}, … en orden.
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  langCode: string,
  bodyParams: string[] = []
): Promise<void> {
  const apiKey = process.env.KAPSO_API_KEY;
  if (!apiKey) throw new Error("KAPSO_API_KEY no configurada");
  const phoneId = process.env.KAPSO_PHONE_NUMBER_ID;
  if (!phoneId) throw new Error("KAPSO_PHONE_NUMBER_ID no configurada");

  const components = bodyParams.length
    ? [{ type: "body", parameters: bodyParams.map((t) => ({ type: "text", text: t })) }]
    : [];

  const res = await fetch(`${apiUrl()}/meta/whatsapp/v24.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: templateName, language: { code: langCode }, components },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kapso sendTemplate falló (${res.status}): ${body}`);
  }
}

/**
 * Descarga un archivo multimedia (ej. una imagen) y lo devuelve como data URL
 * (base64) para pasárselo a un modelo con visión. Valida el host (anti-SSRF) y
 * limita el tamaño.
 */
export async function fetchMediaAsDataUrl(mediaUrl: string, mimeType?: string): Promise<string> {
  const url = assertSafeMediaUrl(mediaUrl);
  const apiKey = process.env.KAPSO_API_KEY;
  const headers: Record<string, string> = {};
  // La auth solo va a los hosts de Kapso; los CDN públicos de WhatsApp no la necesitan.
  if (apiKey && url.hostname.toLowerCase().endsWith("kapso.ai")) headers["X-API-Key"] = apiKey;

  const res = await fetch(url, { headers, redirect: "error" });
  if (!res.ok) throw new Error(`No pude descargar el archivo (${res.status})`);

  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_MEDIA_BYTES) throw new Error("archivo demasiado grande");

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_MEDIA_BYTES) throw new Error("archivo demasiado grande");
  const mt = mimeType || res.headers.get("content-type") || "image/jpeg";
  return `data:${mt};base64,${buf.toString("base64")}`;
}

/**
 * Descarga un archivo multimedia (ej. un PDF) como Buffer. Valida el host
 * (anti-SSRF) y limita el tamaño. Para documentos que hay que parsear, no para
 * pasar a un modelo con visión (para eso está fetchMediaAsDataUrl).
 */
export async function fetchMediaBuffer(mediaUrl: string): Promise<Buffer> {
  const url = assertSafeMediaUrl(mediaUrl);
  const apiKey = process.env.KAPSO_API_KEY;
  const headers: Record<string, string> = {};
  if (apiKey && url.hostname.toLowerCase().endsWith("kapso.ai")) headers["X-API-Key"] = apiKey;

  const res = await fetch(url, { headers, redirect: "error" });
  if (!res.ok) throw new Error(`No pude descargar el archivo (${res.status})`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_MEDIA_BYTES) throw new Error("archivo demasiado grande");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_MEDIA_BYTES) throw new Error("archivo demasiado grande");
  return buf;
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
 * En PRODUCCIÓN, la ausencia del secret NO puede saltear la verificación
 * (fail-closed): si falta el secret en prod, se rechaza todo. Solo en dev/local
 * (sin secret configurado) se permite para poder testear.
 */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.KAPSO_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!signature) return false;

  const received = signature.replace(/^sha256=/, "").trim();
  const hmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8");
  const expectedHex = hmac.digest("hex");
  const expectedB64 = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  // Comparación de tiempo constante para no filtrar el secreto por timing.
  const safeEqual = (a: string, b: string): boolean => {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  };

  return safeEqual(received, expectedHex) || safeEqual(received, expectedB64);
}
