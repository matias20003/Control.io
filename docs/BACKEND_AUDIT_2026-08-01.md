# Auditoría de backend, 1 de agosto de 2026

## Alcance

Revisión de integridad financiera, fechas, zonas horarias, cron jobs, concurrencia,
autorización, dependencias y cobertura automática. Esta auditoría es un documento
vivo: cada hallazgo debe terminar corregido, aceptado explícitamente o cubierto por
un control operativo.

## Criterio de prioridad

`Prioridad = (impacto + riesgo) × (6 - esfuerzo)`, con valores de 1 a 5.

## Hallazgos críticos y altos

| Estado | Área | Hallazgo | Riesgo | Prioridad |
|---|---|---|---:|---:|
| Corregido | Cuotas | Dos requests simultáneos podían pagar una misma cuota dos veces, duplicar el movimiento y descontar dos veces el saldo. | 5 | 45 |
| Corregido | Recurrentes | Dos invocaciones superpuestas del cron podían registrar el mismo período dos veces. | 5 | 45 |
| Corregido | Deudas | El backend aceptaba pagos negativos y usaba una actualización vulnerable a pérdida de escrituras concurrentes. | 5 | 45 |
| Corregido | Recordatorios | QStash y el cron de respaldo podían entregar el mismo recordatorio en paralelo. | 4 | 36 |
| Corregido | Monedas | Los totales mensuales sumaban montos nominales de monedas distintas. Ahora usan el snapshot `amountARS`. | 5 | 36 |
| Corregido | Presupuestos | La moneda era configurable, pero el gasto calculado estaba limitado a ARS. | 4 | 32 |
| Pendiente de operación | Cron jobs | `newsletter`, `reminders` y `weekly-report` no figuran en `vercel.json`. El código declara que dependen de un pinger externo, pero esa programación no está versionada ni monitoreada en el repositorio. | 5 | 36 |
| Pendiente | Suscripciones | Existe lectura de `premiumUntil`, pero no hay flujo de checkout ni webhook de Mercado Pago en el repositorio. La monetización todavía no está implementada. | 5 | 30 |
| Pendiente | Fechas | Hay múltiples implementaciones locales de “hoy”, mes y diferencia de días fuera de `lib/timezone.ts`, especialmente en estudio, tendencias, dashboard y sparklines. | 4 | 24 |
| Pendiente | Integridad de saldo | Ediciones y eliminaciones simultáneas de movimientos pueden competir sobre el mismo saldo. Requiere pruebas de concurrencia contra PostgreSQL y una política de aislamiento explícita. | 5 | 20 |

## Controles ejecutados

- Suite: 239 pruebas aprobadas, 6 omitidas.
- Dependencias de producción: 0 vulnerabilidades conocidas según `npm audit`.
- TypeScript: aprobado después del primer bloque de cambios.
- Autenticación de cron: todos los endpoints revisados exigen `CRON_SECRET`.
- Ownership: movimientos, cuentas, cuotas, deudas y presupuestos validan el usuario en las rutas principales revisadas.

## Deuda técnica priorizada

### Fase 1, integridad económica

1. Añadir pruebas de integración PostgreSQL para pagos, recurrentes y movimientos concurrentes.
2. Unificar cálculos monetarios en valores `Decimal`, evitando `number` en operaciones de dominio.
3. Auditar todos los reportes para que usen snapshots de conversión y nunca tasas actuales.
4. Crear una reconciliación de saldos: saldo almacenado versus saldo derivado de movimientos.

### Fase 2, tiempo y automatización

1. Centralizar fechas calendario argentinas en `lib/timezone.ts`.
2. Versionar la programación externa de cron jobs o migrarla a una infraestructura observable.
3. Registrar cada ejecución de cron con clave idempotente, inicio, fin, resultado y error.
4. Alertar si un cron esperado no se ejecuta dentro de su ventana.

### Fase 3, seguridad y operación

1. Completar la matriz de autorización de todas las server actions y rutas API.
2. Agregar retención y redacción de datos sensibles en logs.
3. Documentar restauración de base, rotación de secretos y respuesta a incidentes.
4. Incorporar CI obligatorio con pruebas, lint, tipos y migración de esquema.

## Dirección comercial inicial

El producto actual es demasiado amplio para venderse como “organizador de vida”.
La ventaja más defendible está en finanzas personales argentinas operadas desde
WhatsApp: ARS y USD, Mercado Pago, ingresos variables, vencimientos y registro sin
planillas. La hipótesis de nicho a validar es **profesionales independientes y
trabajadores freelance de Argentina con ingresos variables**. Antes de construir
el paywall se deben realizar entrevistas y validar qué problema pagarían todos los
meses.

