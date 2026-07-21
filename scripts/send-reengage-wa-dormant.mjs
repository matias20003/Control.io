// Re-enganche INMEDIATO (sin plantilla) de los usuarios que YA tienen WhatsApp
// vinculado pero están dormidos 7+ días. Email con un botón que abre el chat del
// bot con un mensaje listo: cuando ELLOS lo envían, se abre la ventana de 24h y
// el bot los re-engancha libre (les carga el gasto, charla, etc.).
//
// Uso:  node scripts/send-reengage-wa-dormant.mjs "<gmail>" "<app_pw>" --test "vos@mail.com"
//       node scripts/send-reengage-wa-dormant.mjs "<gmail>" "<app_pw>" --all
import { readFileSync } from "node:fs";
import pg from "pg";
import nodemailer from "nodemailer";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1"); }
const [gmailUser, appPassword, mode, testTo] = process.argv.slice(2);
if (!gmailUser || !appPassword || !mode) { console.error("Uso: <gmail> <app_pw> --test|--all [testEmail]"); process.exit(1); }

const BOT_WA = "5493416041118";
const botLink = `https://wa.me/${BOT_WA}?text=${encodeURIComponent("¡Hola! Quiero retomar mis gastos 💪")}`;

function html(name) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:28px;"><span style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:14px;background:#2563EB;color:#fff;font-size:30px;font-weight:700;">c</span></div>
    <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;text-align:center;">${name}, ¿retomamos? 👋</h1>
    <p style="font-size:15px;line-height:1.6;color:#cbd5e1;text-align:center;margin:0 0 24px;">
      Hace un tiempo que no cargás tus gastos en control.io. Lo bueno: <strong style="color:#f8fafc;">ya tenés tu WhatsApp conectado</strong>,
      así que estás a <strong style="color:#f8fafc;">un mensaje</strong> de volver a tener tus números al día.
    </p>
    <div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-size:14px;color:#94a3b8;margin:0 0 12px;font-weight:600;">Tocá el botón y contale tu último gasto:</p>
      <p style="font-size:15px;color:#f8fafc;margin:0 0 6px;">✍️ "gasté 5.000 en el súper"</p>
      <p style="font-size:15px;color:#f8fafc;margin:0;">🎙️ un audio · 📸 la foto de un ticket</p>
    </div>
    <div style="text-align:center;margin-bottom:16px;">
      <a href="${botLink}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 34px;border-radius:10px;">
        Retomar por WhatsApp →
      </a>
    </div>
    <p style="font-size:13px;color:#94a3b8;text-align:center;margin:0 0 28px;">Se abre tu chat con el asistente — mandale un mensaje y sigue todo como antes.</p>
    <p style="font-size:12px;color:#64748b;text-align:center;margin:0;">Si no querés estos recordatorios, ignorá este mail.</p>
  </div></body></html>`;
}

const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: gmailUser, pass: appPassword.replace(/\s+/g, "") } });
await transport.verify().then(() => console.log("Gmail SMTP OK")).catch((e) => { console.error("Gmail rechazó:", e.message); process.exit(1); });
const SUBJECT = "¿Retomamos? Estás a un mensaje de WhatsApp 💪";

if (mode === "--test") {
  await transport.sendMail({ from: `control.io <${gmailUser}>`, to: testTo, subject: SUBJECT, html: html("Test") });
  console.log(`Prueba enviada a ${testTo}`); process.exit(0);
}

const c = new pg.Client({ connectionString: env.DIRECT_URL }); await c.connect();
const { rows } = await c.query(`
  SELECT p.id, p.name, p.email FROM profiles p
  WHERE p."whatsappNumber" IS NOT NULL
    AND (SELECT max(t."createdAt") FROM transactions t WHERE t."userId"=p.id) < now() - interval '7 days'
  ORDER BY (SELECT max(t."createdAt") FROM transactions t WHERE t."userId"=p.id) NULLS FIRST`);
console.log(`\nRe-enganchando a ${rows.length} dormidos-con-WhatsApp...\n`);
let sent = 0, errors = 0;
for (const r of rows) {
  const name = (r.name || r.email.split("@")[0]).split(" ")[0];
  try { await transport.sendMail({ from: `control.io <${gmailUser}>`, to: r.email, subject: SUBJECT, html: html(name) }); sent++; console.log(`  ✅ ${r.email}`); await new Promise((res) => setTimeout(res, 800)); }
  catch (e) { errors++; console.log(`  ❌ ${r.email} — ${e.message}`); }
}
console.log(`\n== ${sent} enviados, ${errors} con error, de ${rows.length} ==`);
await c.end();
