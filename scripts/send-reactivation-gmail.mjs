// Envío de reactivación por SMTP directo (sin depender del dominio verificado en
// Resend). Sirve para la casilla de control.io (Hostinger) o Gmail.
// Corre LOCAL pero pega contra la DB de PRODUCCIÓN (DATABASE_URL de .env.local).
//
// Uso:
//   Prueba (1 solo mail a vos):
//     node scripts/send-reactivation-gmail.mjs "<smtpHost>" "<user@dominio>" "<password>" --test "vos@gmail.com"
//   Envío real a los 20 (marca reactivationNudgeAt en la DB):
//     node scripts/send-reactivation-gmail.mjs "<smtpHost>" "<user@dominio>" "<password>" --all
//
// smtpHost típicos:  smtp.hostinger.com  (control.io) · smtp.gmail.com (Gmail)
import { readFileSync } from "node:fs";
import pg from "pg";
import nodemailer from "nodemailer";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

const [smtpHost, gmailUser, appPassword, mode, testTo] = process.argv.slice(2);
if (!smtpHost || !gmailUser || !appPassword || !mode) {
  console.error('Uso: node scripts/send-reactivation-gmail.mjs "<smtpHost>" "<user>" "<password>" --test|--all ["<test_email>"]');
  process.exit(1);
}
const appUrl = "https://controlio.site";

function html({ name, dormant }) {
  const headline = dormant ? `${name}, ¿todo bien? 👋` : `${name}, ¿arrancamos? 👋`;
  const intro = dormant
    ? `Hace un tiempo que no pasás por control.io. Tus cuentas, movimientos y números te están esperando — entrá y ponete al día en un toque.`
    : `Te registraste en control.io pero todavía no cargaste tu primer movimiento. Toma <strong style="color:#f8fafc;">menos de 10 segundos</strong> y recién ahí la app cobra vida con tus números.`;
  const cta = dormant ? "Volver a control.io →" : "Cargar mi primer movimiento →";
  const examples = dormant ? "" :
    `<div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-size:14px;color:#94a3b8;margin:0 0 12px;font-weight:600;">Probá cargar algo así:</p>
      <p style="font-size:15px;color:#f8fafc;margin:0 0 6px;">🔴 Gasté $5.000 en el súper</p>
      <p style="font-size:15px;color:#f8fafc;margin:0;">🟢 Cobré mi sueldo</p></div>`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:28px;"><span style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:14px;background:#2563EB;color:#fff;font-size:30px;font-weight:700;">c</span></div>
    <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;text-align:center;">${headline}</h1>
    <p style="font-size:15px;line-height:1.6;color:#cbd5e1;text-align:center;margin:0 0 24px;">${intro}</p>
    ${examples}
    <div style="text-align:center;margin-bottom:28px;"><a href="${appUrl}/dashboard" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;">${cta}</a></div>
    <p style="font-size:12px;color:#64748b;text-align:center;margin:0;">Si no querés estos recordatorios, ignorá este mail — no te escribimos de nuevo.</p>
  </div></body></html>`;
}

const transport = nodemailer.createTransport({
  host: smtpHost, port: 465, secure: true,
  auth: { user: gmailUser, pass: appPassword.replace(/\s+/g, "") },
});

// Verifica credenciales primero.
await transport.verify().then(() => console.log(`✅ SMTP autenticado (${smtpHost})`)).catch((e) => {
  console.error(`❌ ${smtpHost} rechazó las credenciales:`, e.message); process.exit(1);
});

if (mode === "--test") {
  if (!testTo) { console.error("Falta el email de prueba"); process.exit(1); }
  await transport.sendMail({
    from: `control.io <${gmailUser}>`, to: testTo,
    subject: "¿Arrancamos? Cargá tu primer movimiento en control.io 💸",
    html: html({ name: testTo.split("@")[0], dormant: false }),
  });
  console.log(`✅ Email de prueba enviado a ${testTo}. Revisá tu bandeja (y spam).`);
  process.exit(0);
}

// --all : envío real a los 20 candidatos.
const c = new pg.Client({ connectionString: env.DATABASE_URL }); await c.connect();
const { rows } = await c.query(`
  SELECT p.id, p.email, p.name,
    (SELECT count(*) FROM transactions t WHERE t."userId" = p.id)::int movs
  FROM profiles p
  WHERE (p."reactivationNudgeAt" IS NULL OR p."reactivationNudgeAt" < now() - interval '14 days')
    AND p."createdAt" < now() - interval '20 hours'
    AND (NOT EXISTS (SELECT 1 FROM transactions t WHERE t."userId" = p.id)
      OR (SELECT max(t."createdAt") FROM transactions t WHERE t."userId" = p.id) < now() - interval '14 days')
  ORDER BY p."createdAt" ASC LIMIT 200`);

console.log(`\nEnviando a ${rows.length} candidatos...\n`);
let sent = 0, errors = 0;
for (const r of rows) {
  const dormant = r.movs > 0;
  const name = r.name || r.email.split("@")[0];
  try {
    await transport.sendMail({
      from: `control.io <${gmailUser}>`, to: r.email,
      subject: dormant ? "Te extrañamos en control.io 👀" : "¿Arrancamos? Cargá tu primer movimiento en control.io 💸",
      html: html({ name, dormant }),
    });
    await c.query(`UPDATE profiles SET "reactivationNudgeAt" = now() WHERE id = $1`, [r.id]);
    sent++; console.log(`  ✅ ${r.email}`);
    await new Promise((res) => setTimeout(res, 800)); // suave con Gmail
  } catch (e) {
    errors++; console.log(`  ❌ ${r.email} — ${e.message}`);
  }
}
console.log(`\n== Resultado: ${sent} enviados, ${errors} con error, de ${rows.length} ==`);
await c.end();
