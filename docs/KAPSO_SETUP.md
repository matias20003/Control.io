# 🤖 Bot de WhatsApp con Kapso — control.io

Asistente financiero por WhatsApp usando **Kapso** (gestionado, sobre WhatsApp Cloud API).
Sin servidor propio, sin Docker, sin mantener nada prendido. Plan Free: 2.000 msgs/mes.

```
WhatsApp (chip)  ─►  Kapso (transcribe audio + webhook)  ─►  /api/whatsapp/kapso
                                                                   │
                          interpreta con IA (OpenAI/Groq) ◄────────┤
                          crea Transaction en la DB ◄──────────────┤
        confirmación  ◄── Kapso API (sendText) ◄───────────────────┘
```

## Componentes (ya implementados)

| Archivo | Qué hace |
|---|---|
| `app/api/whatsapp/kapso/route.ts` | Recibe el webhook de Kapso, valida la firma y responde |
| `lib/whatsapp/kapso.ts` | Cliente de Kapso: enviar texto + verificar firma HMAC |
| `lib/whatsapp/assistant.ts` | Interpreta el mensaje con IA y crea los movimientos |
| `lib/whatsapp/users.ts` | Vincula el número de WhatsApp ↔ usuario |
| Configuración → Perfil | Tarjeta para vincular tu número |

---

## ETAPA A — Crear cuenta en Kapso

1. Entrá a https://kapso.ai/ → **Sign up** (plan **Free**, $0/mes).
2. En el panel vas a tener un **sandbox** para probar al instante (sin trámite de Meta).

## ETAPA B — Obtener las credenciales

En el panel de Kapso:
1. **Project API Key** (Settings / API) → será `KAPSO_API_KEY`.
2. **Phone Number ID** del número/sandbox conectado → será `KAPSO_PHONE_NUMBER_ID`.
3. Cuando configures el webhook (Etapa D), Kapso te da un **Secret Key** → `KAPSO_WEBHOOK_SECRET`.

## ETAPA C — Variables de entorno en Vercel

Vercel → tu proyecto → **Settings → Environment Variables**:
```
KAPSO_API_KEY          = (tu Project API Key)
KAPSO_PHONE_NUMBER_ID  = (id del número conectado)
KAPSO_WEBHOOK_SECRET   = (secret del webhook)
OPENAI_API_KEY         = sk-...        # para interpretar (o key de Groq, ver nota)
```
Después: **Redeploy** del proyecto.

## ETAPA D — Configurar el webhook en Kapso

En el panel de Kapso → **Webhooks** (o Settings → Webhooks):
- **URL:** `https://controlio.site/api/whatsapp/kapso`
  (o `https://control-io.vercel.app/api/whatsapp/kapso` si todavía no propagó el dominio)
- **Evento:** `whatsapp.message.received`
- Copiá el **Secret Key** que genera y ponelo en `KAPSO_WEBHOOK_SECRET` (Vercel).

## ETAPA E — Conectar el chip

En el panel de Kapso, conectá tu número:
- **Sandbox:** seguís las instrucciones para mandar el código de activación (prueba instantánea).
- **Número propio (producción):** Kapso te da un *setup link* para vincularlo vía Meta.

## ETAPA F — Vincular tu número y probar

1. App → **Configuración → Perfil → Asistente de WhatsApp** → cargá tu número.
2. Escribile al bot:
   - `gasté 5 lucas en el súper`
   - 🎤 audio: *"hoy gasté 3000 en nafta y 1500 en un café"*
   - `cuánto gasté este mes?`

---

## Notas

- **Audios:** Kapso los transcribe solo y manda el texto en `message.kapso.transcript.text`.
  No necesitás Whisper/OpenAI para eso.
- **IA gratis (Groq):** poné en Vercel `OPENAI_API_KEY=tu_key_de_groq`,
  `OPENAI_BASE_URL=https://api.groq.com/openai/v1`, `CHAT_MODEL=llama-3.3-70b-versatile`.
- **Seguridad:** el webhook valida la firma HMAC con `KAPSO_WEBHOOK_SECRET`. Si no lo
  configurás, no bloquea (solo para desarrollo).
- **Sin hosting:** todo corre en Vercel (tu app) + Kapso (WhatsApp). Nada que mantener prendido.
