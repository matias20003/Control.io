import { Resend } from "resend";

// Lazy: se crea solo cuando se llama, no al importar (evita crash en build sin env vars)
let _resend: Resend | null = null;
export function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

export const FROM = process.env.RESEND_FROM ?? "control.io <noreply@control.io>";
