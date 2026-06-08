# 🧪 Kit de testing — control.io

Todo lo que necesitás para invitar a probadores. Copiá y pegá lo que te sirva.

- **App:** https://controlio.site (si falla, usar https://control-io.vercel.app)
- **Asistente de WhatsApp:** +54 9 341 604-1118 · link directo: https://wa.me/5493416041118

---

## 1) Mensaje de invitación (para mandar por WhatsApp)

> ¡Hola! 👋 Estoy probando **control.io**, una app para llevar tus finanzas personales
> (gastos, ingresos, cuentas, deudas, metas) que además tiene un **asistente de WhatsApp**:
> le mandás un texto, un audio o una foto de un ticket y te carga el movimiento solo.
>
> Está en fase de **prueba** y tu opinión me ayuda muchísimo 🙏 ¿Te animás a probarla unos días?
>
> **Cómo empezar (5 minutos):**
> 1. Entrá a 👉 https://controlio.site y creá tu cuenta.
> 2. Cargá una cuenta (Efectivo, banco, Mercado Pago) con la plata que tengas hoy.
> 3. Registrá un par de gastos e ingresos.
> 4. 🤖 Conectá el asistente: **Configuración → Perfil → Asistente de WhatsApp**, poné tu número
>    y aceptá. Después tocá **"Abrir asistente en WhatsApp"** y escribile algo como
>    *"gasté 5 lucas en el súper"* o mandale un audio.
>
> Usala como si fuera tuya y después contame qué te pareció. Cualquier error o idea, ¡mandámelo!
> Gracias por la mano 🚀

---

## 2) Qué pedirles que prueben (checklist)

Mandales esto o tenelo a mano:

**Lo básico**
- [ ] Crear cuenta e iniciar sesión
- [ ] Crear cuentas (Efectivo, banco, etc.) con saldo
- [ ] Cargar gastos, ingresos y una transferencia
- [ ] Mirar el Dashboard y Movimientos

**Funciones**
- [ ] Crear un presupuesto y una meta de ahorro
- [ ] Anotar una deuda
- [ ] Ver Reporte semanal y Tendencias
- [ ] Cambiar a modo claro/oscuro (Configuración → Apariencia)

**El asistente de WhatsApp** 🤖 (lo más importante)
- [ ] Registrar un gasto por **texto** ("gasté 3 lucas en nafta")
- [ ] Registrar por **audio**
- [ ] Mandar una **foto de un ticket**
- [ ] Preguntarle: *"¿cuánto gasté este mes?"*, *"¿cuál es mi saldo?"*
- [ ] Pedirle un análisis: *"¿cómo vengo este mes?"*, *"¿estoy ahorrando bien?"*

**Importante:** probala en el **celular** (está pensada para mobile).

---

## 3) Preguntas de feedback (para que te respondan)

Pasales estas preguntas (por WhatsApp, audio, o un Google Form):

1. ¿Qué te resultó **confuso o difícil** de usar?
2. ¿Algo **no funcionó o dio error**? ¿En qué pantalla?
3. ¿El **asistente de WhatsApp** entendió bien lo que le mandaste? ¿Falló en algo?
4. ¿Qué **le falta** o qué le cambiarías?
5. Del **1 al 10**, ¿la usarías en tu día a día? ¿Por qué?
6. ¿Se lo recomendarías a alguien? ¿A quién?

---

## 4) Aclaraciones para los testers

- Es una **versión de prueba**: puede tener errores, ¡por eso los necesito! 🙌
- Tus datos están **encriptados** y podés **borrar todo** cuando quieras
  (Configuración → Datos → Eliminar todos mis datos).
- Podés usar datos reales o inventados, como te sientas cómodo.
- Si el asistente de WhatsApp no te responde la primera vez, esperá unos segundos y reintentá.

---

## 5) Para vos (mientras testean)

- Mirá las **grabaciones de sesión** y los clicks en **PostHog** para ver cómo usan la app y dónde se traban.
- Controlá el **uso del bot** en `/admin` para no pasarte del límite gratis de mensajes.
- Anotá los bugs que te reporten y priorizá por cuántos los mencionan.
