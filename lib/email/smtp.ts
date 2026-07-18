/**
 * Envío de email por SMTP directo (Gmail / casilla de control.io), como
 * alternativa a Resend cuando el dominio todavía no está verificado.
 *
 * Config por env vars (setear en Vercel):
 *   GMAIL_USER          → dirección remitente (ej. control.io.oficial@gmail.com)
 *   GMAIL_APP_PASSWORD  → App Password de Google (16 chars)
 *   SMTP_HOST           → opcional, default smtp.gmail.com
 *
 * Si GMAIL_USER/GMAIL_APP_PASSWORD no están, gmailConfigured() = false y el
 * código sigue usando Resend.
 */
import nodemailer, { type Transporter } from "nodemailer";

let _transport: Transporter | null = null;

export function gmailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function transport(): Transporter {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, ""),
    },
  });
  return _transport;
}

/** Nombre visible del remitente (marca) + la dirección Gmail configurada. */
export function gmailFrom(): string {
  return `control.io <${process.env.GMAIL_USER}>`;
}

/** Envía un email por SMTP. Lanza si falla (para poder contarlo como error). */
export async function sendViaGmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  await transport().sendMail({
    from: gmailFrom(),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}
