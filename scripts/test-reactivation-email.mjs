// Verificación end-to-end del envío de reactivación SIN tocar a los usuarios reales.
// Uso:  node scripts/test-reactivation-email.mjs
// Lee RESEND_API_KEY / RESEND_FROM / ADMIN_EMAIL de .env.local.
//
// Hace 3 cosas:
//   1) Confirma que hay RESEND_API_KEY.
//   2) Lista los dominios de tu cuenta Resend y su estado de verificación.
//   3) Manda UN email de reactivación de prueba a ADMIN_EMAIL (vos), no a los 20.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

const KEY  = env.RESEND_API_KEY;
const FROM = env.RESEND_FROM || "control.io <noreply@controlio.site>";
const TO   = process.argv[2] || env.ADMIN_EMAIL;

if (!KEY) {
  console.error("❌ RESEND_API_KEY vacío en .env.local. Pegá la key (re_...) y volvé a correr.");
  process.exit(1);
}
if (!TO || TO === "tu-email@gmail.com") {
  console.error("❌ No hay destino de prueba. Pasá tu email:  node scripts/test-reactivation-email.mjs vos@gmail.com");
  process.exit(1);
}

const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// 1+2) Dominios verificados
const domRes = await fetch("https://api.resend.com/domains", { headers: H });
const domJson = await domRes.json();
if (!domRes.ok) {
  console.error("❌ La API key fue rechazada por Resend:", domJson);
  process.exit(1);
}
console.log("== Dominios en tu cuenta Resend ==");
const domains = domJson.data ?? domJson;
if (!domains?.length) {
  console.log("  (ninguno) — necesitás verificar un dominio para enviar a terceros.");
} else {
  for (const d of domains) console.log(`  - ${d.name.padEnd(24)} status=${d.status}`);
}
const fromDomain = FROM.match(/@([^>\s]+)/)?.[1];
const match = domains?.find((d) => d.name === fromDomain);
console.log(`\nRemitente (${FROM}) usa dominio "${fromDomain}": ${
  match ? (match.status === "verified" ? "✅ verificado" : `⚠️ ${match.status}`) : "❌ NO está en tu cuenta"
}`);

// 3) Email de prueba
console.log(`\n== Enviando email de prueba a ${TO} ==`);
const sendRes = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: H,
  body: JSON.stringify({
    from: FROM,
    to: TO,
    subject: "[PRUEBA] Reactivación control.io",
    html: `<div style="font-family:sans-serif;padding:24px"><h2>✅ Prueba de reactivación</h2><p>Si recibís esto, el envío de reactivación funciona. Ya podés usar “Enviar ahora” en el admin.</p></div>`,
  }),
});
const sendJson = await sendRes.json();
if (!sendRes.ok || sendJson.error) {
  console.error("❌ Falló el envío:", sendJson.error ?? sendJson);
  process.exit(1);
}
console.log("✅ Email aceptado por Resend. id:", sendJson.id ?? sendJson.data?.id);
console.log("   Revisá tu bandeja. Si llegó, la reactivación está funcional.");
