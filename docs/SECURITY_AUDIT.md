# Auditoría de seguridad — control.io

Fecha: 2026-07-18 · Alcance: app completa (Next.js 16 + Supabase + Prisma), foco en la
protección de datos de cada usuario. Método: revisión de código de todas las rutas API,
funciones `lib/db/*`, server actions, auth/proxy, crypto, webhooks y dependencias, más
pruebas activas en producción.

## Veredicto general

**Postura de seguridad por encima del promedio para un proyecto de este tamaño.** Los
fundamentos críticos están bien: **aislamiento de datos sólido** (no se encontró IDOR
entre usuarios en las entidades financieras), **sin inyección SQL**, criptografía AES-256-GCM
correcta, headers de seguridad completos, MFA, y control de admin fail-closed. Los hallazgos
son mayormente de *endurecimiento* y un desactualizado de framework; ninguno expone hoy los
datos de un usuario a otro.

---

## Fortalezas verificadas (lo que está bien)

- **Aislamiento entre usuarios:** cada query en `lib/db/*` filtra por `userId`; toda
  mutación por id usa `where: { id, userId }` o un `findFirst({id,userId})` de ownership.
  `transactions`/`import`/`recurrentes` pre-validan la propiedad de cuenta/categoría. No se
  halló IDOR en transacciones, cuentas, metas, deudas, presupuestos, recurrentes, cuotas,
  inversiones, tareas ni recordatorios.
- **`userId` nunca viene del cliente:** las 20 server actions lo derivan de la sesión
  server-side (`supabase.auth.getUser()`), nunca de formData/params/body.
- **Grupos:** cada lectura/mutación valida membresía; invitaciones con token `randomUUID`
  inadivinable; borrado solo por el creador.
- **Sin SQL injection:** todas las queries raw usan tagged templates (parámetros bindeados).
- **Crypto sólido:** AES-256-GCM con IV único por dato, auth tag, sin fuga de texto plano.
- **Auth:** sesión validada server-side en el layout del dashboard, MFA `aal2` forzado,
  OAuth de Google con CSRF `state`, admin fail-closed (`email === ADMIN_EMAIL`), service-role
  key solo server-side y detrás de un check de recovery-code.
- **Headers:** HSTS (1año + subdominios), X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, CSP con `frame-ancestors 'self'`.
- **Secretos:** `.env.local` gitignoreado y nunca committeado; sin secretos hardcodeados en
  el repo. `nodemailer` (agregado esta sesión): sin vulnerabilidades.

---

## Hallazgos priorizados

### 🔴 ALTA

**H1 — Next.js 16.2.4 desactualizado (múltiples advisories High).**
`package.json`. Incluye bypass de middleware/proxy en App Router, cache poisoning en RSC,
XSS con nonces, SSRF vía WebSocket. La app usa `proxy.ts` + Supabase auth → las clases de
bypass de middleware la afectan directo.
**Fix:** `npm i next@16.2.10` y redeploy. Máximo impacto, mínimo esfuerzo.

### 🟠 MEDIA

**M1 — Webhook de WhatsApp (Kapso) falla en abierto en el código.**
`lib/whatsapp/kapso.ts:87-90` — `if (!secret) return true`. Si `KAPSO_WEBHOOK_SECRET`
faltara, cualquier POST sería aceptado y un atacante podría inyectar movimientos como
cualquier usuario (el `from` lo controla él).
**Estado en vivo (verificado):** el secret **SÍ está seteado en prod** — un POST sin firma
devuelve `401`. O sea, **hoy NO es explotable.** Igual conviene endurecer.
**Fix:** fallar cerrado en producción (`if (!secret) return false`).

**M2 — HTML injection en emails transaccionales (phishing).**
`lib/email/invitacion-grupo.ts`, `weekly-report.ts`, `reactivation.ts`. Nombres de
usuario/grupo/categoría/cuenta se interpolan **sin escapar** en el HTML. Un nombre como
`<a href="phish">Verificá tu cuenta</a>` mete links/HTML atacante en un mail que parece
venir de control.io. (Los clientes de mail bloquean JS, así que es HTML/link injection, no
XSS ejecutable.)
**Fix:** escapar (`& < > " '`) todo valor interpolado en un helper compartido.

**M3 — SSRF en la descarga de media de WhatsApp.**
`lib/whatsapp/kapso.ts:44-56` — `fetchMediaAsDataUrl` baja una URL arbitraria del payload
sin validar esquema/host ni bloquear IPs internas. Está detrás de la firma del webhook (hoy
activa), pero si M1 regresa, permite pegarle a `169.254.169.254` u otros servicios internos.
**Fix:** exigir `https:`, allowlist de hosts de Kapso/WhatsApp, rechazar IPs privadas/loopback,
cap de tamaño.

**M4 — Sin rate limiting en el webhook de WhatsApp.**
`app/api/whatsapp/kapso/route.ts`. El endpoint más caro (LLM de visión + chat) no tiene
rate limit (el helper `@upstash/ratelimit` solo se usa en login/registro). Abuso de costo de IA.
**Fix:** `rateLimit()` por `from`/IP antes de invocar al asistente.

**M5 — Auth de crons se saltea si `NODE_ENV !== "production"`.**
`app/api/cron/*` — `if (process.env.NODE_ENV !== "production") return true`. Cualquier deploy
no productivo (preview/staging) expone los crons sin auth: disparar mails masivos o crear
transacciones falsas.
**Fix:** exigir el Bearer siempre; convenience de test detrás de un flag explícito, no de `NODE_ENV`.

**M6 — PostHog `autocapture: true` puede filtrar datos financieros.**
`components/PostHogProvider.tsx`. El enmascarado (`maskAllInputs`, `maskTextSelector`) aplica
solo al session-replay, **no al autocapture**: los eventos de click/change mandan el texto del
elemento (`$el_text`) —montos, nombres de cuenta/categoría— a un tercero.
**Fix:** desactivar autocapture o scrubear `$el_text` con `before_send`.

**M7 — `decrypt()` falla en silencio → pérdida de datos en rotación de clave.**
`lib/crypto.ts:62-65`. Ante clave equivocada devuelve `null` (no tira error). Cambiar/perder
`ENCRYPTION_KEY` borra silenciosamente todo lo encriptado, sin aviso. No hay versionado de clave.
**Fix:** loggear fallos de desencriptado (sin loggear el plano) y agregar un byte de versión de
clave al layout para poder rotar.

**M8 — Teléfono (`whatsappNumber`) guardado en texto plano.**
`prisma/schema.prisma` — PII directa sin encriptar. Un compromiso solo-de-DB expone todos los
teléfonos.
**Fix:** encriptar `whatsappNumber` o documentar el riesgo aceptado.

### 🟡 BAJA

- **L1 — Inyección de fórmulas en export CSV.** `app/api/export/transactions/route.ts` — `esc()`
  no neutraliza `= + - @`. Descripción `=HYPERLINK(...)` se ejecuta al abrir en Excel/Sheets.
  Fix: prefijar con `'` las celdas que empiezan con esos caracteres.
- **L2 — Presupuesto acepta `categoryId` sin validar ownership.** `lib/db/budgets.ts` — permite
  leer el nombre (plano) de la categoría de otro usuario. Fix: `findFirst({id,userId})` antes del upsert.
- **L3 — Compra a crédito acepta `accountId`/`categoryId` sin validar.** `lib/db/credit.ts` — sin
  fuga legible (queda encriptado) pero inconsistente con el resto. Fix: validar ownership.
- **L4 — Vincular WhatsApp sin verificar propiedad del número.** `lib/db/profile.ts` — un atacante
  puede reclamar el número de otro (denegación/atribución, no lectura). Fix: OTP al número.
- **L5 — Reasignación de suscripción push por `endpoint`.** `app/api/push/subscribe/route.ts` —
  upsert por endpoint sobrescribe `userId`. Fix: scopear `where: { endpoint, userId }`.
- **L6 — Comparación de secreto no constant-time** en crons/qstash (`===`). Fix: `timingSafeEqual`.
- **L7 — QStash no verifica su firma `Upstash-Signature`** (solo confía en el Bearer). Fix: usar el `Receiver`.
- **L8 — Mensajes de error internos filtrados al cliente** en algunas rutas (`e.message`). Fix: mensaje genérico + log server-side.
- **L9 — Vulnerabilidades transitivas** (`ws`, `hono`, `fast-uri`, `dompurify`, etc.). Fix: `npm audit fix`.

---

## Notas arquitectónicas / operativas

- **RLS NO es un backstop.** Prisma conecta como superusuario (`DATABASE_URL`) y **bypasea RLS**
  (documentado en `supabase/rls-policies.sql`). El aislamiento depende 100% de que cada query
  recuerde el filtro `userId`. Hoy la disciplina es buena, pero una sola query futura que lo
  olvide = fuga entre usuarios. Recomendación: test/lint que exija `userId`, o una extensión de
  Prisma que fuerce el filtro de tenant.
- **La clave de encriptación vive junto a los datos** (mismo env que `DATABASE_URL` y la
  service-role key). La encriptación de campos protege contra un breach *solo-de-DB* (backup
  filtrado), no contra un compromiso del servidor/env. Documentar el modelo de amenaza; evaluar KMS.
- **Rotar secretos por precaución:** los secretos productivos de `.env.local` (service-role key,
  password de DB, `OPENROUTER_API_KEY`, `CRON_SECRET`, `ENCRYPTION_KEY`) y la **App Password de
  Gmail** circularon en contexto/chat esta sesión. No están en git, pero conviene rotarlos.
  (Ojo: rotar `ENCRYPTION_KEY` requiere re-encriptar los datos — ver M7.)

---

## Plan de remediación (orden sugerido)

1. **Subir Next.js a 16.2.10** + `npm audit fix` (H1, L9). Rápido y de alto impacto.
2. **Fail-closed en el webhook + validar `media_url`** (M1, M3).
3. **Escapar HTML en todos los templates de email** (M2).
4. **Rate limit en el webhook de WhatsApp** (M4).
5. **Crons: exigir el Bearer siempre** (M5).
6. **PostHog: desactivar/scrubear autocapture** (M6).
7. **Encriptar `whatsappNumber` + versión de clave/telemetría de fallos** (M7, M8).
8. **Endurecimientos BAJA** (L1–L8) + los 2 checks de ownership faltantes (L2, L3).
9. **Rotar los secretos** surfaceados esta sesión.
