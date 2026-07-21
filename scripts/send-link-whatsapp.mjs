// Email de "vinculá WhatsApp en 1 toque" a los usuarios registrados que NO
// vincularon (la conversión más barata: ya se registraron, les falta el paso
// clave). El botón abre WhatsApp con "Vincular <code>" listo → el bot captura su
// número real y los vincula solo.
//
// Uso:
//   Prueba (1 mail a vos):  node scripts/send-link-whatsapp.mjs "<gmail>" "<app_pw>" --test "vos@mail.com"
//   Envío real a los 15:    node scripts/send-link-whatsapp.mjs "<gmail>" "<app_pw>" --all
import { readFileSync } from "node:fs";
import pg from "pg";
import nodemailer from "nodemailer";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1"); }

const [gmailUser, appPassword, mode, testTo] = process.argv.slice(2);
if (!gmailUser || !appPassword || !mode) { console.error("Uso: node scripts/send-link-whatsapp.mjs <gmail> <app_pw> --test|--all [testEmail]"); process.exit(1); }

const BOT_WA = "5493416041118";
const waLink = (code) => `https://wa.me/${BOT_WA}?text=${encodeURIComponent(`Vincular ${code}`)}`;

function html(name, code) {
  const link = waLink(code);
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:28px;"><span style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:14px;background:#2563EB;color:#fff;font-size:30px;font-weight:700;">c</span></div>
    <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;text-align:center;">${name}, te falta el paso que lo cambia todo 👇</h1>
    <p style="font-size:15px;line-height:1.6;color:#cbd5e1;text-align:center;margin:0 0 24px;">
      Te registraste en control.io pero todavía no conectaste tu WhatsApp — y ahí está la magia:
      en vez de cargar gastos a mano, se los <strong style="color:#f8fafc;">contás a un chat</strong> y él los anota solos.
    </p>
    <div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-size:14px;color:#94a3b8;margin:0 0 12px;font-weight:600;">Vas a poder mandarle:</p>
      <p style="font-size:15px;color:#f8fafc;margin:0 0 6px;">✍️ "gasté 5.000 en el súper"</p>
      <p style="font-size:15px;color:#f8fafc;margin:0 0 6px;">🎙️ un audio contándole el gasto</p>
      <p style="font-size:15px;color:#f8fafc;margin:0;">📸 la foto de un ticket</p>
    </div>
    <div style="text-align:center;margin-bottom:16px;">
      <a href="${link}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 34px;border-radius:10px;">
        Vincular mi WhatsApp en 1 toque →
      </a>
    </div>
    <p style="font-size:13px;color:#94a3b8;text-align:center;margin:0 0 28px;">
      Se abre WhatsApp con un mensaje listo — solo tocá <strong style="color:#f8fafc;">enviar</strong> y quedás conectado. No tenés que escribir ni tu número.
    </p>
    <p style="font-size:12px;color:#64748b;text-align:center;margin:0;">Si no querés estos recordatorios, ignorá este mail.</p>
  </div></body></html>`;
}

const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: gmailUser, pass: appPassword.replace(/\s+/g, "") } });
await transport.verify().then(() => console.log("Gmail SMTP autenticado OK")).catch((e) => { console.error("Gmail rechazó credenciales:", e.message); process.exit(1); });

const SUBJECT = "Cargá tus gastos hablándole a WhatsApp — te lo dejo en 1 toque 👇";

if (mode === "--test") {
  await transport.sendMail({ from: `control.io <${gmailUser}>`, to: testTo, subject: SUBJECT, html: html("Test", "abc123de") });
  console.log(`Email de prueba enviado a ${testTo}`); process.exit(0);
}

const c = new pg.Client({ connectionString: env.DIRECT_URL }); await c.connect();
const { rows } = await c.query(`SELECT id, name, email, "whatsappLinkCode" code FROM profiles WHERE "whatsappNumber" IS NULL AND "whatsappLinkCode" IS NOT NULL ORDER BY "createdAt"`);
console.log(`\nEnviando a ${rows.length} usuarios sin vincular...\n`);
let sent = 0, errors = 0;
for (const r of rows) {
  const name = (r.name || r.email.split("@")[0]).split(" ")[0];
  try {
    await transport.sendMail({ from: `control.io <${gmailUser}>`, to: r.email, subject: SUBJECT, html: html(name, r.code) });
    sent++; console.log(`  ✅ ${r.email}`);
    await new Promise((res) => setTimeout(res, 800));
  } catch (e) { errors++; console.log(`  ❌ ${r.email} — ${e.message}`); }
}
console.log(`\n== ${sent} enviados, ${errors} con error, de ${rows.length} ==`);
await c.end();
