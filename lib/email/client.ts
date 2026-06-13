import { Resend } from "resend";

// Lazy: se crea solo cuando se llama, no al importar (evita crash en build sin env vars)
let _resend: Resend | null = null;
export function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

// Sender por defecto: un dominio PROPIO (Resend no entrega desde gmail.com).
// Requiere que controlio.site esté verificado en Resend (Domains + DNS).
// Override con la env var RESEND_FROM en Vercel si querés otra dirección.
export const FROM =
  process.env.RESEND_FROM ?? "control.io <noreply@controlio.site>";
