# Reactivación / Emails — verificar dominio en Resend

## Estado (diagnóstico en producción)

La reactivación de inactivos (y **todos** los emails transaccionales) NO se envían.
Prueba en vivo contra producción:

```
$ curl -H "Authorization: Bearer <CRON_SECRET>" https://controlio.site/api/cron/reactivation
{"ok":true,"sent":0,"errors":20,"total":20,
 "lastError":"The controlio.site domain is not verified. Please, add and verify your domain on https://resend.com/domains"}
```

Conclusión:

- ✅ El código funciona (candidatos, cron, botón "Enviar ahora").
- ✅ `RESEND_API_KEY` está configurada y es válida en Vercel.
- ❌ **El dominio `controlio.site` NO está verificado en Resend** → Resend rechaza cada envío.

La causa NO es código. Es verificación de dominio (registros DNS). Sin esto, ningún
email sale (reactivación, recordatorios de vencimientos, feedback, etc.).

## Fix (una sola vez, ~5 min)

DNS de `controlio.site` está en **Hostinger** (nameservers `*.dns-parking.com`).

1. **resend.com/domains → Add Domain** → `controlio.site`.
   Resend muestra ~3 registros (el DKIM es único de tu cuenta):
   - `TXT`  host `resend._domainkey`  → clave DKIM (copiar de Resend)
   - `TXT`  host `send`               → `v=spf1 include:amazonses.com ~all`
   - `MX`   host `send`               → `feedback-smtp.<region>.amazonses.com`  (prioridad 10)
   - (opcional) `TXT` host `_dmarc`   → `v=DMARC1; p=none;`
2. **Hostinger → hPanel → controlio.site → Zona DNS** → agregar esos registros tal cual.
3. Resend → **Verify** (propaga en minutos).

> Alternativa: verificar un subdominio dedicado (p.ej. `send.controlio.site`) y setear
> `RESEND_FROM="control.io <noreply@send.controlio.site>"` en Vercel. Mismo procedimiento DNS.

## Confirmar que quedó funcional

Cuando Resend diga *verified*, correr de nuevo (esto ejecuta lo mismo que el botón
"Enviar ahora" y reactiva a los pendientes de verdad):

```
curl -H "Authorization: Bearer <CRON_SECRET>" https://controlio.site/api/cron/reactivation
# esperado: {"ok":true,"sent":20,"errors":0,"total":20}
```

El panel de admin también muestra el estado real del dominio (verde = operativo,
rojo = motivo exacto) — ver `app/admin/AdminAnalytics.tsx` + `lib/email/domain-status.ts`.
