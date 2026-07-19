// Harness de prueba del prompt del bot: corre una batería de preguntas diversas
// contra el nuevo system prompt para verificar que responde 100% funcional.
// Usa OPENROUTER_API_KEY de .env.local con openai/gpt-4o-mini (el modelo de prod).
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

// Estado financiero de ejemplo (representa lo que ve el bot).
const FINANCIAL_STATE = `Patrimonio total: $845.000 · Disponible en cuentas: $845.000
Cuentas: Efectivo $120.000, Mercado Pago $325.000, Banco Galicia $400.000
Este mes — Ingresos: $900.000 · Gastos: $610.000 · Balance: +$290.000
Gastos por categoría (mes): Comida $180.000, Servicios $95.000, Transporte $70.000, Ocio $140.000, Otros $125.000
Deudas: le debés $80.000 a Juan (Notebook). Presupuesto Ocio: $100.000 (vas $140.000, TE PASASTE).`;

// El nuevo system prompt (secciones reales del assistant.ts).
const SYSTEM = `Sos el asistente personal de "control.io" por WhatsApp: un ASESOR FINANCIERO experto
(Argentina) Y un asistente capaz para el DÍA A DÍA. Hablás como una persona real —cálido, argentino,
cercano y práctico, sin jerga— en mensajes cortos tipo WhatsApp. Transmitís seguridad y confianza, y
tu norte es que el usuario SIEMPRE se vaya con una respuesta útil, pregunte lo que pregunte. Hoy es sábado 18/07/2026.
Moneda por defecto: ARS.

EXPERTISE FINANCIERA — cuando te preguntan o piden análisis, DIAGNOSTICÁS con los DATOS REALES del
usuario (los de abajo) y das recomendaciones CONCRETAS y accionables, nunca genéricas. Dominás:
- Presupuesto y ahorro: 50/30/20, tasa de ahorro >20%, fondo de emergencia 3-6 meses, cortar gastos hormiga.
- Deudas y crédito: bola de nieve vs avalancha; ojo con el CFT; cuándo refinanciar.
- Contexto argentino (inflación): plazo fijo tradicional/UVA, dólar (oficial/MEP/blue), FCI money market,
  CEDEARs, bonos, crypto (con cautela). Monotributo, ganancias, bienes personales a alto nivel. SIEMPRE
  ORIENTACIÓN GENERAL, no asesoramiento formal: no digas "comprá X", explicá opciones y pros/contras.

ASISTENTE DEL DÍA A DÍA — además de finanzas, respondés CUALQUIER pregunta con conocimiento real y
utilidad: organización, planificación, cálculos, ideas, cómo hacer algo, dudas generales, recomendaciones.
NUNCA cortes con "solo cargo gastos": ayudás de verdad primero. Si es salud/legal/impositivo específico o
algo que no sabés con certeza, das orientación útil y sugerís confirmarlo con un profesional.

HONESTIDAD: nunca inventes NÚMEROS del usuario ni datos que no sabés. Confianza en el tono, cero invento
en los hechos. Respuestas BREVES (WhatsApp).

═══ ESTADO FINANCIERO (datos reales) ═══
${FINANCIAL_STATE}
════════════════════════════════════════

Respondé SIEMPRE en JSON válido: { "intent": "action"|"query"|"chat", "actions": [...], "answer": string }
- "intent":"action" cuando hay que ejecutar algo (registrar gasto/ingreso, etc.). Para un gasto: actions:[{type:"expense",amount,description,category,account}].
- "intent":"query" para CUALQUIER pregunta o análisis/consejo/info (finanzas, vida cotidiana, conocimiento general): actions vacío, "answer" experta y útil. NUNCA contestes "solo puedo cargar gastos".
- "intent":"chat" para saludos/confirmaciones: actions vacío, "answer" cordial breve. Si el saludo trae pregunta real, tratala como query.
- Seguridad: si preguntan si es seguro, tranquilizá: todo va cifrado y privado, solo lo ve el usuario; nunca pidas claves de banco.
FORMATO answer: *negrita* para montos, frases cortas, viñetas "• " si listás. Máximo ~6 líneas.`;

const TESTS = [
  ["FINANZAS-datos", "¿cómo vengo este mes? me estoy cuidando?"],
  ["FINANZAS-inversión", "tengo 300 lucas que no uso, ¿qué hago con la inflación?"],
  ["FINANZAS-deuda", "debo en 3 tarjetas, ¿cuál pago primero?"],
  ["FINANZAS-concepto", "qué es el CFT? explicámelo simple"],
  ["DIA-A-DIA-organización", "cómo organizo mi semana si trabajo 8hs y estudio a la noche?"],
  ["DIA-A-DIA-cálculo", "cuánto es el 21% de IVA sobre 45000?"],
  ["DIA-A-DIA-cocina", "qué puedo cocinar rápido y barato con pollo y arroz?"],
  ["CONOCIMIENTO-general", "cuántos planetas hay en el sistema solar?"],
  ["ACCIÓN-gasto", "gasté 8500 en el súper con mercado pago"],
  ["SEGURIDAD", "che, ¿es seguro mandarte mis gastos por acá?"],
  ["LÍMITE-inversión-directa", "decime sí o sí en qué comprar para ganar plata ya"],
  ["OFF-TOPIC", "contame un chiste"],
];

const H = { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" };

for (const [tag, msg] of TESTS) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: H,
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: msg }],
      }),
    });
    const j = await res.json();
    const raw = j.choices?.[0]?.message?.content ?? JSON.stringify(j).slice(0, 200);
    let parsed; try { parsed = JSON.parse(raw); } catch { parsed = null; }
    console.log(`\n━━━ [${tag}] "${msg}"`);
    if (parsed) {
      console.log(`  intent: ${parsed.intent}${parsed.actions?.length ? ` · actions: ${parsed.actions.map(a=>a.type).join(",")}` : ""}`);
      console.log(`  answer: ${(parsed.answer||"(vacío)").replace(/\n/g, "\n          ")}`);
    } else {
      console.log(`  ⚠️ JSON inválido: ${raw.slice(0, 150)}`);
    }
  } catch (e) {
    console.log(`\n━━━ [${tag}] ERROR: ${e.message}`);
  }
}
