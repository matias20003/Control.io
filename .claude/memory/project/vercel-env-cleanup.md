---
name: vercel-env-cleanup
description: Hay 2 env vars rotas en Vercel para revisar y limpiar
type: project
---

# Limpieza pendiente de env vars en Vercel (control-io)

Pendiente al 18/05/2026, detectado mientras configurábamos Resend SMTP.

## Variables a revisar / borrar

1. **`ENCRYPTION_KE`** (sin la `Y` final) — typo de `ENCRYPTION_KEY`.
   El código solo lee `ENCRYPTION_KEY` ([lib/crypto.ts:17](../../../lib/crypto.ts#L17)), así que esa está muerta.
   → Borrar.

2. **Variable con nombre `cf715570c02a20f736e8...9c9bb3f47634d8236256`** (64 chars hex como nombre).
   Probablemente fue creada pegando un valor hex donde iba el nombre.
   → Pedir al usuario hacer "Reveal" del valor. Si es basura, borrar. Si es algo crítico (ej. el `ENCRYPTION_KEY` real), copiarlo a la var correcta antes de borrar.

## Cómo retomar

URL del panel:
`https://vercel.com/yorismatias372-5389s-projects/control-io/settings/environment-variables`

Pasos:
1. Reveal del valor `cf71...256` y decidir.
2. Borrar `ENCRYPTION_KE`.
3. Redeploy con cache OFF.

## Por qué importa

Ruido visual en el panel y, sobre todo, riesgo de futuras confusiones (alguien podría borrar la `ENCRYPTION_KEY` real por error pensando que era duplicada).
