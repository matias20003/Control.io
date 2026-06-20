/**
 * Cerebro del asistente de WhatsApp (agente de acciones).
 *
 * - Interpreta mensajes en lenguaje natural (texto o audio transcripto).
 * - Responde consultas sobre TODO el estado financiero con datos reales.
 * - Ejecuta acciones: registrar gastos/ingresos, transferencias, crear cuentas,
 *   deudas (crear/pagar), presupuestos, metas (crear/aportar) y editar/borrar
 *   movimientos.
 *
 * Variables de entorno:
 *   OPENAI_API_KEY   → clave del proveedor (OpenAI / OpenRouter / Groq)
 *   OPENAI_BASE_URL  → opcional, default https://api.openai.com/v1
 *   CHAT_MODEL       → opcional, default "gpt-4o-mini"
 */
import { getAccounts, createAccount, updateAccount, type SerializedAccount } from "@/lib/db/accounts";
import { getCategories, type SerializedCategory } from "@/lib/db/categories";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getMonthSummary,
  getTransactions,
  type MonthSummary,
  type SerializedTransaction,
} from "@/lib/db/transactions";
import { getNetWorth, type NetWorth } from "@/lib/db/insights";
import { getDebts, createDebt, payDebt, type SerializedDebt } from "@/lib/db/debts";
import { getBudgets, createOrUpdateBudget, type SerializedBudget } from "@/lib/db/budgets";
import { getGoals, createGoal, addFundsToGoal, type SerializedGoal } from "@/lib/db/goals";
import { getInvestments, type SerializedInvestment } from "@/lib/db/investments";
import { getTasks, createTask, toggleTask, deleteTask, type SerializedTask } from "@/lib/db/tasks";
import { createReminder, getPendingReminders, type SerializedReminder } from "@/lib/db/reminders";
import { createCalendarEvent, createGoogleTask, getGoogleStatus } from "@/lib/google";
import { getIsTester } from "@/lib/db/profile";
import { hasFeature } from "@/lib/feature-flags";
import { ARG_TZ } from "@/lib/timezone";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { format as formatDateFn } from "date-fns";
import { getChatHistory, saveChatTurn, getMemory, addMemory, type ChatTurn } from "@/lib/whatsapp/memory";

type Intent = "action" | "query" | "chat";

const ACCOUNT_TYPES = [
  "CASH",
  "BANK",
  "DIGITAL_WALLET",
  "CREDIT_CARD",
  "SAVINGS",
  "INVESTMENT",
  "CRYPTO",
  "FOREIGN_CURRENCY",
];

interface Action {
  type: string;
  amount?: number;
  currency?: "ARS" | "USD";
  description?: string;
  date?: string;
  category?: string | null;
  account?: string | null;
  reportOnly?: boolean;
  fromAccount?: string | null;
  toAccount?: string | null;
  name?: string;
  accountType?: string;
  balance?: number;
  direction?: "i_owe" | "they_owe";
  personName?: string;
  targetAmount?: number;
  currentAmount?: number;
  goalName?: string;
  ref?: number;
  fact?: string;
  title?: string;   // create_task / create_reminder (el texto)
  dueDate?: string; // create_task (YYYY-MM-DD)
  taskRef?: number; // complete_task / delete_task ([#N] de TUS TAREAS)
  inMinutes?: number; // create_reminder: dentro de X minutos
  remindAt?: string;  // create_reminder: fecha/hora exacta ARG "YYYY-MM-DDTHH:mm"
  eventStart?: string; // agendar_evento: inicio ARG "YYYY-MM-DDTHH:mm"
  durationMin?: number; // agendar_evento: duración en minutos (default 60)
}

interface AssistantOutput {
  intent: Intent;
  actions: Action[];
  answer: string;
}

interface FinancialContext {
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  summary: MonthSummary;
  netWorth: NetWorth | null;
  debts: SerializedDebt[];
  budgets: SerializedBudget[];
  goals: SerializedGoal[];
  investments: SerializedInvestment[];
  recent: SerializedTransaction[];
  memory: string[];
  today: string;
  monthLabel: string;
  month: number;
  year: number;
  isTester: boolean;
  tasks: SerializedTask[];
  reminders: SerializedReminder[];
  nowArg: string; // "YYYY-MM-DDTHH:mm" hora Argentina (para recordatorios)
  googleConnected: boolean;
}

function baseUrl(): string {
  return (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
}

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(DIACRITICS, "").trim();
}

function fmt(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
}

function money(n: number, currency = "ARS"): string {
  return currency === "USD" ? `USD ${fmt(n)}` : `$${fmt(n)}`;
}

function fail(msg: string): never {
  throw new Error(msg);
}

/** Devuelve la fecha de la acción (ISO) si es válida y no futura, sino hoy. */
function resolveDate(date: string | undefined, isoDate: string): string {
  if (!date) return isoDate;
  const t = Date.parse(date);
  if (isNaN(t)) return isoDate;
  // No permitimos fechas futuras (un movimiento no puede ser de mañana).
  if (t > Date.parse(isoDate)) return isoDate;
  return new Date(t).toISOString();
}

// ─────────────────────────── Resolución nombre → entidad ───────────────────────────

function findCategory(c: FinancialContext, name: string | null | undefined, type: "INCOME" | "EXPENSE") {
  if (!name) return null;
  return (
    c.categories.find((x) => x.type === type && norm(x.name) === norm(name)) ??
    c.categories.find((x) => x.type === type && norm(x.name).includes(norm(name))) ??
    null
  );
}

function findAccount(c: FinancialContext, name: string | null | undefined) {
  if (!name) return null;
  return (
    c.accounts.find((a) => norm(a.name) === norm(name)) ??
    c.accounts.find((a) => norm(a.name).includes(norm(name))) ??
    null
  );
}


// ─────────────────────────── Contexto para el LLM ───────────────────────────

function formatFinancialState(c: FinancialContext): string {
  const s: string[] = [];

  s.push(
    `CUENTAS Y SALDOS:\n` +
      (c.accounts.length
        ? c.accounts.map((a) => `- ${a.name} (${a.type}): ${money(a.balance, a.currency)}`).join("\n")
        : "- (sin cuentas)")
  );

  if (c.netWorth) {
    s.push(
      `PATRIMONIO NETO (ARS): activos ${money(c.netWorth.totalAssets)}, pasivos ${money(
        c.netWorth.totalLiabilities
      )}, neto ${money(c.netWorth.netWorth)}`
    );
  }

  const cats = c.summary.byCategory.map((b) => `${b.name} ${money(b.total)}`).join(", ");
  s.push(
    `RESUMEN ${c.monthLabel.toUpperCase()}: ingresos ${money(c.summary.totalIncome)}, gastos ${money(
      c.summary.totalExpense
    )}, balance ${money(c.summary.balance)}` + (cats ? `\nGastos por categoría: ${cats}` : "")
  );

  if (c.recent.length) {
    s.push(
      `ÚLTIMOS MOVIMIENTOS (usá el número [#N] como "ref" para editar/borrar):\n` +
        c.recent
          .slice(0, 15)
          .map((t, i) => {
            const d = new Date(t.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
            const sign = t.type === "INCOME" ? "+" : t.type === "EXPENSE" ? "-" : "";
            const cat = t.categoryName ? ` · ${t.categoryName}` : "";
            const acc = t.accountName ? ` (${t.accountName})` : "";
            return `[#${i + 1}] ${d} ${sign}${money(t.amount, t.currency)} ${t.description ?? ""}${cat}${acc}`.trim();
          })
          .join("\n")
    );
  }

  const openDebts = c.debts.filter((d) => !d.isCompleted);
  if (openDebts.length) {
    s.push(
      `DEUDAS:\n` +
        openDebts
          .map((d) => {
            const who = d.direction === "I_OWE" ? `Le debo a ${d.personName}` : `${d.personName} me debe`;
            return `- ${who}: ${money(d.remainingAmount, d.currency)} pendientes (de ${money(d.totalAmount, d.currency)})`;
          })
          .join("\n")
    );
  }

  if (c.budgets.length) {
    s.push(
      `PRESUPUESTOS (${c.monthLabel}):\n` +
        c.budgets.map((b) => `- ${b.categoryName}: ${money(b.spent)} de ${money(b.amount)} (${b.percentage}%)`).join("\n")
    );
  }

  if (c.goals.length) {
    s.push(
      `METAS:\n` +
        c.goals
          .map((g) => `- ${g.name}: ${money(g.currentAmount, g.currency)} de ${money(g.targetAmount, g.currency)} (${g.percentage}%)`)
          .join("\n")
    );
  }

  if (c.investments.length) {
    s.push(
      `INVERSIONES:\n` +
        c.investments
          .map((i) => {
            const val = i.currentValue != null ? `, valor actual ${money(i.currentValue, i.currency)}` : "";
            return `- ${i.name} (${i.type}): invertido ${money(i.amount, i.currency)}${val}`;
          })
          .join("\n")
    );
  }

  if (hasFeature("tareas", { isTester: c.isTester }) && c.tasks.length) {
    s.push(
      `TUS TAREAS PENDIENTES (usá el número [#N] como "taskRef" para completar/borrar):\n` +
        c.tasks
          .slice(0, 15)
          .map((t, i) => {
            const due = t.dueDate
              ? ` (vence ${new Date(t.dueDate).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })})`
              : "";
            return `[#${i + 1}] ${t.title}${due}`;
          })
          .join("\n")
    );
  }

  if (hasFeature("recordatorios", { isTester: c.isTester }) && c.reminders.length) {
    s.push(
      `RECORDATORIOS PROGRAMADOS:\n` +
        c.reminders
          .slice(0, 10)
          .map((r) => {
            const d = toZonedTime(new Date(r.remindAt), ARG_TZ);
            return `- ${formatDateFn(d, "dd/MM HH:mm")}: ${r.text}`;
          })
          .join("\n")
    );
  }

  return s.join("\n\n");
}

async function interpret(
  message: string,
  c: FinancialContext,
  imageUrl?: string,
  history: ChatTurn[] = []
): Promise<AssistantOutput> {
  const apiKey = process.env.OPENAI_API_KEY ?? fail("OPENAI_API_KEY no configurada");
  const model = process.env.CHAT_MODEL ?? "gpt-4o-mini";

  const expenseCats = c.categories.filter((x) => x.type === "EXPENSE").map((x) => x.name);
  const incomeCats = c.categories.filter((x) => x.type === "INCOME").map((x) => x.name);

  const system = `Sos un ASESOR FINANCIERO profesional (Argentina) dentro de "control.io", una app de
finanzas personales. Hablás claro, cercano y práctico, sin jerga innecesaria. Hoy es ${c.today}.${hasFeature("recordatorios", { isTester: c.isTester }) ? ` Ahora en Argentina: ${c.nowArg}.` : ""}
Moneda por defecto: ARS.

Sabés de finanzas personales y de negocios. Cuando te preguntan o piden análisis, DIAGNOSTICÁS con
los DATOS REALES del usuario (los de abajo) y das recomendaciones CONCRETAS y accionables — no
respuestas genéricas. Principios que aplicás:
- Regla 50/30/20 (necesidades / gustos / ahorro-deuda).
- Fondo de emergencia: 3 a 6 meses de gastos.
- Tasa de ahorro saludable: apuntar a >20% de los ingresos.
- Deudas: estrategia "bola de nieve" (saldar primero la más chica, motiva) vs "avalancha"
  (primero la de mayor interés, óptima). Recomendá según el caso.
- Controlar gastos hormiga, automatizar el ahorro, presupuestar por categoría.
- Contexto argentino: inflación alta → conviene proteger excedentes (dólar/USD, plazo fijo UVA,
  etc.), pero aclarando que es ORIENTACIÓN GENERAL, no asesoramiento de inversión formal.
Sé honesto: nunca inventes números, usá solo los del sistema. Si falta info, decilo. Respuestas
BREVES (es WhatsApp), claras y útiles.

También EJECUTÁS acciones: registrar gastos/ingresos, transferencias, crear cuentas, deudas,
presupuestos, metas, editar/borrar movimientos, y recordar datos del usuario.

═══════════ ESTADO FINANCIERO (datos reales) ═══════════
${formatFinancialState(c)}
════════════════════════════════════════════════════════

LO QUE SABÉS DEL USUARIO (memoria de charlas anteriores):
${c.memory.length ? c.memory.map((m) => `- ${m}`).join("\n") : "- (todavía no tenés notas guardadas)"}

CATEGORÍAS de gasto: ${expenseCats.join(", ") || "ninguna"}
CATEGORÍAS de ingreso: ${incomeCats.join(", ") || "ninguna"}
TIPOS de cuenta válidos: ${ACCOUNT_TYPES.join(", ")}

Jerga argentina de montos: "5 lucas"/"5k"=5000, "un palo"=1.000.000, "500 mangos"=500.
Sin aclarar moneda → ARS. "dólares"/"usd"/"verdes" → USD.

SOLO REGISTRO (no afecta el saldo): poné "reportOnly": true cuando el usuario quiera dejar
asentado un gasto/ingreso SIN que modifique el saldo ni el patrimonio. Ej: "cargá estos del mes
solo para el registro", "no toques el saldo", "esto ya está en mi plata actual", o cuando importa
movimientos históricos de un mes ya pasado. En ese caso NO se asocia a ninguna cuenta. Para un
movimiento normal de ahora (que SÍ debe descontar/sumar a la cuenta), dejá reportOnly en false.

CUENTA OBLIGATORIA: para un gasto o ingreso REAL (reportOnly en false) SIEMPRE necesitás saber
CON QUÉ CUENTA es (Efectivo, Mercado Pago, banco, etc.). Si el usuario NO mencionó la cuenta y
tiene MÁS DE UNA, NO registres todavía: respondé (intent "chat") preguntando con qué cuenta fue,
nombrando las cuentas disponibles. Recién cuando sepas la cuenta emití la acción con "account".
Si tiene UNA sola cuenta, usala sin preguntar.

AJUSTAR SALDO (set_balance): si el usuario te dice CUÁNTO TIENE en una cuenta —"en Mercado Pago
tengo 50.000", "mi saldo del banco es 120 lucas", "tengo 30k en efectivo", "corregí/poné el saldo
de X en Y"— usá intent "action" con set_balance { account, balance }. Esto FIJA el saldo de esa
cuenta a ese valor: NO lo registres como ingreso ni gasto (no es plata que entró/salió, es el
saldo real que el usuario está informando). El "account" tiene que ser una de las cuentas existentes.

SEGUIMIENTO DE CUENTA (MUY IMPORTANTE): si en un mensaje TUYO anterior (mirá el HISTORIAL)
preguntaste con qué cuenta registrar uno o más movimientos, y AHORA el usuario responde indicando
la(s) cuenta(s), TENÉS que emitir intent "action" RE-EMITIENDO esos movimientos COMPLETOS (cada uno
con su amount, type, description y date originales, tomados del historial) y con el campo "account"
ya resuelto. Mapeá cada monto a la cuenta que dijo el usuario. Ejemplos:
- Vos preguntaste por un ingreso de $1.500 y un gasto de $2.500. Usuario: "1500 en efectivo y 2500
  en mercado pago" → emití income 1500 account "Efectivo" + expense 2500 account "Mercado Pago".
- Usuario responde solo "efectivo" y había UN movimiento pendiente → emitilo con account "Efectivo".
- Usuario responde solo "efectivo" y había VARIOS pendientes sin aclarar cuál → asigná esa cuenta a
  TODOS los pendientes.
NUNCA vuelvas a hacer la misma pregunta si el usuario ya respondió la cuenta. NO uses intent "chat"
para repetir la pregunta cuando ya tenés la respuesta.

FECHAS: el campo "date" (formato "YYYY-MM-DD") es opcional. Si el usuario dice CUÁNDO fue el
movimiento ("ayer", "anteayer", "el lunes", "el mes pasado", "el 5 de mayo", "la semana pasada"),
calculá la fecha respecto de HOY (${c.today}) y ponela en "date". Si solo dice el mes sin día,
usá el día 15 de ese mes. Si no menciona fecha, OMITÍ "date" (se usa hoy). Nunca uses fechas futuras.

Si te mandan una IMAGEN:
- Si es UN ticket/recibo/factura/captura: generá la acción (normalmente "expense", o "income"
  si es un cobro). En un ticket de compra con varios ítems, sumalos en UN solo gasto con el total,
  salvo que el usuario pida separarlos.
- Si es una LISTA de varios movimientos anotados (varias filas con concepto y monto): creá UNA
  acción por cada movimiento.
- IMPORTANTE con las FECHAS: si en la imagen figura una fecha para cada movimiento (o una fecha
  general), usá ESA fecha en el campo "date" (YYYY-MM-DD) de cada acción. NO uses la fecha de hoy
  si la imagen indica otra. Si un ítem no tiene fecha visible, omití "date" en ese ítem.
Elegí siempre la categoría que mejor encaje.

Respondé SIEMPRE en JSON válido:
{
  "intent": "action" | "query" | "chat",
  "actions": [ ... ],
  "answer": string
}

TIPOS DE ACCIÓN (campo "type"):
- "expense" / "income": { amount, currency, description, category, account, date, reportOnly }
- "transfer": { amount, currency, description, fromAccount, toAccount, date }
- "create_account": { name, accountType, currency, balance }   // accountType de la lista
- "set_balance": { account, balance }   // FIJA el saldo ACTUAL de una cuenta existente (no es ingreso ni gasto)
- "create_debt": { direction: "i_owe"|"they_owe", personName, amount, currency, description }
- "pay_debt": { personName, amount }
- "create_budget": { category, amount }                        // categoría de gasto, mes actual
- "create_goal": { name, targetAmount, currency, currentAmount }
- "add_to_goal": { goalName, amount }
- "delete_transaction": { ref }                                // ref = número [#N] de la lista
- "update_transaction": { ref, amount, description, category, account }  // solo los campos a cambiar
- "remember": { fact }   // guardar un DATO DURABLE del usuario (cómo es su plata/vida: "cobro los días 10", "mi alquiler es 200k"). NO es una tarea.
${hasFeature("tareas", { isTester: c.isTester }) ? `- "create_task": { title, dueDate }   // un PENDIENTE/recordatorio a HACER ("recordame entregar el TP el martes", "tengo que comprar pilas", "anotá llamar al banco"). dueDate "YYYY-MM-DD" opcional, relativo a HOY. Diferente de "remember": esto es algo PENDIENTE, no un dato.
- "complete_task": { taskRef }   // marcar una tarea como HECHA ("ya entregué el TP", "listo lo de las pilas"). taskRef = [#N] de TUS TAREAS PENDIENTES.
- "delete_task": { taskRef }   // borrar/cancelar una tarea. taskRef = [#N] de TUS TAREAS PENDIENTES.` : ``}
${hasFeature("recordatorios", { isTester: c.isTester }) ? `- "create_reminder": { title, inMinutes, remindAt }   // recordatorio CON HORA que te aviso ("haceme acordar en 5 min de sacar la comida", "recordame mañana a las 9 llamar al banco"). title = qué recordar. Para "en X minutos/horas" usá inMinutes (5, 120). Para una hora/fecha puntual usá remindAt "YYYY-MM-DDTHH:mm" en hora Argentina (calculada desde AHORA). Es distinto de create_task: el recordatorio DISPARA un aviso a una hora exacta.` : ``}
${hasFeature("google", { isTester: c.isTester }) && c.googleConnected ? `- "agendar_evento": { title, eventStart, durationMin }   // crea un EVENTO en Google Calendar ("agendá turno médico el jueves 10hs", "reunión mañana 15hs", "cumple de Ana el 20"). title = qué. eventStart = "YYYY-MM-DDTHH:mm" en hora Argentina (relativo a HOY). durationMin opcional (default 60). Usalo para citas/eventos con fecha y hora; create_task es para to-dos sin hora.` : ``}
REGLAS:
- "intent":"action" cuando hay que ejecutar algo (llená "actions"). Podés poner varias acciones.
- "intent":"query" para preguntas, análisis o consejos: "actions" vacío, respondé en "answer" usando los datos reales (montos con $ y miles), con diagnóstico + recomendación concreta.
- "intent":"chat" para saludos/fuera de tema: "actions" vacío, "answer" cordial.
${hasFeature("recordatorios", { isTester: c.isTester }) ? `- ⚠️ CRÍTICO: si el usuario pide que le RECUERDES o le AVISES algo ("haceme acordar", "recordame", "avisame en 5 min", "avisame mañana a las 9"), es SIEMPRE intent "action" con UNA acción create_reminder. PROHIBIDO responder solo con texto como "te recordaré en 2 minutos" o "dale, te aviso" — eso NO programa nada y el recordatorio NO existe. TENÉS que emitir la acción: { "type": "create_reminder", "title": "<qué recordar>", "inMinutes": <N> } para "en N minutos/horas", o "remindAt":"YYYY-MM-DDTHH:mm" para una hora puntual. Ejemplo — usuario: "haceme acordar en 2 min de tomar agua" → {"intent":"action","actions":[{"type":"create_reminder","title":"tomar agua","inMinutes":2}],"answer":""}` : ``}
${hasFeature("tareas", { isTester: c.isTester }) ? `- Si el usuario pide ANOTAR un pendiente sin hora ("anotá comprar pilas", "tengo que llamar al banco"), es intent "action" con create_task — NO lo prometas por texto.
- Si te preguntan por sus pendientes ("qué tengo que hacer", "mis tareas", "qué me falta"), es intent "query": listá TUS TAREAS PENDIENTES en "answer" (cortito, con la fecha si tiene). Si no tiene ninguna, decíselo.` : ``}
- "remember": usalo cuando el usuario comparta algo DURABLE para tener en cuenta a futuro
  ("acordate que cobro el día 1", "mi meta es comprar un auto", "soy freelance", "no me gusta endeudarme").
  Guardá el dato como una frase corta en "fact". NO guardes movimientos puntuales ni datos triviales.
- "category"/"account" SOLO de las listas/cuentas dadas, o null. Para borrar/editar, usá el "ref" [#N] de ÚLTIMOS MOVIMIENTOS.
- Pedidos destructivos (borrar/editar): hacelos solo si el usuario lo pide claramente.
- Usá el HISTORIAL de la charla para entender referencias ("¿y comparado con el mes pasado?", "sí, hacelo").
- NUNCA inventes datos ni acciones que el usuario no pidió. "answer" siempre presente (vacío si no aplica).
- NO repitas acciones: cada movimiento que menciona el usuario se registra UNA sola vez (no pongas la misma acción dos veces en "actions").
- NUNCA vuelvas a registrar un movimiento que YA registraste antes. Si en el HISTORIAL ves un "✅ Hecho" tuyo con ese movimiento, o aparece en ÚLTIMOS MOVIMIENTOS, YA ESTÁ CARGADO: no lo emitas de nuevo.
- Si el usuario responde "sí", "ok", "dale", "listo", "gracias", "perfecto" DESPUÉS de que registraste algo, es solo una CONFIRMACIÓN: usá intent "chat" con una respuesta breve (ej: "¡Listo! 👍"). NO registres nada de nuevo. Solo registrá movimientos que el usuario describe explícitamente en SU mensaje actual.
- Cuando "intent" es "action" y registrás movimientos, la app YA muestra sola la confirmación (monto, descripción, categoría y cuenta). Por eso NO reescribas eso en "answer": dejá "answer" VACÍO. Usalo solo si tenés un dato EXTRA y breve que aporte de verdad (ej. "Ojo, ya vas *$40.000* en Comida este mes"). Nunca repitas el gasto/ingreso registrado.

FORMATO de "answer" (WhatsApp): ordenado y fácil de escanear.
- Usá *negrita* (UN asterisco) para los montos y los totales importantes.
- Frases cortas. Si listás varias cosas, una por línea empezando con "• ".
- Nada de párrafos largos: máximo ~6 líneas, salvo que pidan más detalle.
- Un emoji al inicio de un bloque está bien; no abuses ni uses tablas.`;

  // Contenido del usuario: texto, o texto + imagen (multimodal) si hay foto.
  const userContent: unknown = imageUrl
    ? [
        { type: "text", text: message || "Interpretá esta imagen (ticket/recibo/captura) y registrá los gastos o ingresos que veas." },
        { type: "image_url", image_url: { url: imageUrl } },
      ]
    : message;

  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM falló (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: AssistantOutput;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("El modelo no devolvió JSON válido");
  }

  return {
    intent: parsed.intent ?? "chat",
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    answer: typeof parsed.answer === "string" ? parsed.answer : "",
  };
}

// ─────────────────────────── Ejecución de acciones ───────────────────────────

/**
 * Se lanza cuando una acción no se puede completar porque falta la cuenta
 * (con 2+ cuentas no adivinamos). NO es un error: es una pregunta al usuario.
 * Se maneja aparte para no rotularla como "✅ Hecho".
 */
class NeedsAccount extends Error {}

/**
 * Se lanza cuando el modelo re-emite un movimiento que YA registramos hace
 * poco (típico cuando el usuario dice "sí"/"ok" y el modelo re-procesa el
 * historial). No se vuelve a cargar.
 */
class AlreadyRegistered extends Error {}

/** Ejecuta una acción y devuelve la línea de confirmación, o lanza error. */
async function runAction(userId: string, a: Action, c: FinancialContext, isoDate: string): Promise<string> {
  const cur = a.currency === "USD" ? "USD" : "ARS";

  // Normalización defensiva: el modelo a veces omite "type" o usa un alias al
  // ajustar el saldo. Si trae balance + cuenta y no es claramente otra cosa, es set_balance.
  if (!a.type || ["update_balance", "ajustar_saldo", "set-balance", "saldo", "balance"].includes(a.type)) {
    if (a.balance !== undefined && a.account) a.type = "set_balance";
  }

  switch (a.type) {
    case "expense":
    case "income": {
      const type = a.type === "expense" ? "EXPENSE" : "INCOME";
      if (!a.amount || a.amount <= 0) throw new Error("monto inválido");
      const desc = a.description || (type === "EXPENSE" ? "Gasto" : "Ingreso");

      // Anti-duplicado ENTRE turnos: si el modelo re-emite un movimiento que ya
      // registramos recién (mismo tipo, monto y descripción en los últimos 15
      // min), no lo cargamos de nuevo. Evita que un "Si"/"ok" duplique todo.
      const dup = c.recent.find(
        (t) =>
          t.type === type &&
          Math.abs(t.amount - a.amount!) < 0.01 &&
          norm(t.description ?? "") === norm(desc) &&
          Date.parse(isoDate) - Date.parse(t.createdAt) < 15 * 60 * 1000
      );
      if (dup) throw new AlreadyRegistered();

      const cat = findCategory(c, a.category, type);
      // "reportOnly" → sin cuenta: queda en el reporte pero no mueve el saldo/patrimonio.
      // Backstop de "cuenta obligatoria": si es un movimiento real y no se aclaró
      // la cuenta, con 1 sola cuenta la usamos; con 2+ preguntamos en vez de
      // adivinar; con 0 cuentas se registra sin asociar.
      let acc: SerializedAccount | null = null;
      if (!a.reportOnly) {
        acc = findAccount(c, a.account) ?? null;
        if (!acc) {
          if (c.accounts.length === 1) acc = c.accounts[0];
          else if (c.accounts.length >= 2) {
            throw new NeedsAccount(
              `📌 ¿Con qué cuenta registro ${type === "EXPENSE" ? "este gasto" : "este ingreso"} de ${money(a.amount, cur)}${a.description ? ` (${a.description})` : ""}? Tenés: ${c.accounts.map((x) => x.name).join(", ")}.`
            );
          }
        }
      }
      const txDate = resolveDate(a.date, isoDate);
      await createTransaction(userId, {
        type,
        amount: a.amount,
        currency: cur,
        description: a.description || (type === "EXPENSE" ? "Gasto" : "Ingreso"),
        date: txDate,
        categoryId: cat?.id,
        accountId: acc?.id,
        notes: "Registrado por WhatsApp",
      });
      const emoji = type === "EXPENSE" ? "🔴" : "🟢";
      const sign = type === "EXPENSE" ? "-" : "+";
      const dateTxt = a.date && txDate.slice(0, 10) !== isoDate.slice(0, 10)
        ? ` 📅 ${new Date(txDate).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}`
        : "";
      const noteTxt = a.reportOnly ? "\n📝 _solo registro, no afecta el saldo_" : "";
      const meta = [cat ? `${cat.icon ?? "🏷️"} ${cat.name}` : null, acc ? `🏦 ${acc.name}` : null]
        .filter(Boolean)
        .join(" · ");
      return `${emoji} *${sign}${money(a.amount, cur)}* · ${desc}${meta ? `\n${meta}` : ""}${dateTxt}${noteTxt}`.trim();
    }

    case "transfer": {
      if (!a.amount || a.amount <= 0) throw new Error("monto inválido");
      const from = findAccount(c, a.fromAccount);
      const to = findAccount(c, a.toAccount);
      if (!from || !to) throw new Error("no encontré alguna de las cuentas de la transferencia");
      await createTransaction(userId, {
        type: "TRANSFER",
        amount: a.amount,
        currency: cur,
        description: a.description || "Transferencia",
        date: resolveDate(a.date, isoDate),
        accountId: from.id,
        toAccountId: to.id,
      });
      return `🔄 ${money(a.amount, cur)} — ${from.name} → ${to.name}`;
    }

    case "create_account": {
      if (!a.name) throw new Error("falta el nombre de la cuenta");
      const t = a.accountType && ACCOUNT_TYPES.includes(a.accountType) ? a.accountType : "CASH";
      await createAccount(userId, {
        name: a.name,
        type: t,
        currency: cur,
        balance: a.balance ?? 0,
      });
      return `🏦 Cuenta creada: ${a.name} (saldo ${money(a.balance ?? 0, cur)})`;
    }

    case "set_balance": {
      const acc = findAccount(c, a.account);
      if (!acc) throw new Error(`no encontré la cuenta "${a.account ?? ""}"`);
      const value = a.balance ?? a.amount;
      if (value === undefined || value === null || isNaN(value)) {
        throw new Error("no entendí a cuánto poner el saldo");
      }
      await updateAccount(userId, acc.id, { balance: value });
      return `🏦 Saldo de ${acc.name} actualizado a *${money(value, acc.currency)}*`;
    }

    case "create_debt": {
      if (!a.personName || !a.amount || a.amount <= 0) throw new Error("faltan datos de la deuda");
      const direction = a.direction === "they_owe" ? "THEY_OWE" : "I_OWE";
      await createDebt(userId, {
        direction,
        personName: a.personName,
        totalAmount: a.amount,
        currency: cur,
        description: a.description,
      });
      return direction === "I_OWE"
        ? `🤝 Anotado: le debés ${money(a.amount, cur)} a ${a.personName}`
        : `🤝 Anotado: ${a.personName} te debe ${money(a.amount, cur)}`;
    }

    case "pay_debt": {
      if (!a.personName || !a.amount || a.amount <= 0) throw new Error("faltan datos del pago");
      const debt =
        c.debts.find((d) => !d.isCompleted && norm(d.personName) === norm(a.personName!)) ??
        c.debts.find((d) => !d.isCompleted && norm(d.personName).includes(norm(a.personName!)));
      if (!debt) throw new Error(`no encontré una deuda pendiente con ${a.personName}`);
      const updated = await payDebt(userId, debt.id, a.amount);
      return `✅ Pagué ${money(a.amount, debt.currency)} de la deuda con ${debt.personName} (faltan ${money(updated.remainingAmount, debt.currency)})`;
    }

    case "create_budget": {
      if (!a.amount || a.amount <= 0) throw new Error("monto de presupuesto inválido");
      const cat = findCategory(c, a.category, "EXPENSE");
      if (!cat) throw new Error(`no encontré la categoría "${a.category}"`);
      await createOrUpdateBudget(userId, {
        categoryId: cat.id,
        amount: a.amount,
        currency: cur,
        month: c.month,
        year: c.year,
      });
      return `📊 Presupuesto de ${cat.name}: ${money(a.amount, cur)} para ${c.monthLabel}`;
    }

    case "create_goal": {
      if (!a.name || !a.targetAmount || a.targetAmount <= 0) throw new Error("faltan datos de la meta");
      await createGoal(userId, {
        name: a.name,
        targetAmount: a.targetAmount,
        currency: cur,
        currentAmount: a.currentAmount,
      });
      return `🎯 Meta creada: ${a.name} (objetivo ${money(a.targetAmount, cur)})`;
    }

    case "add_to_goal": {
      if (!a.goalName || !a.amount || a.amount <= 0) throw new Error("faltan datos del aporte");
      const goal =
        c.goals.find((g) => norm(g.name) === norm(a.goalName!)) ??
        c.goals.find((g) => norm(g.name).includes(norm(a.goalName!)));
      if (!goal) throw new Error(`no encontré la meta "${a.goalName}"`);
      const updated = await addFundsToGoal(userId, goal.id, a.amount);
      return `🎯 Sumé ${money(a.amount, goal.currency)} a "${goal.name}" (${money(updated.currentAmount, goal.currency)} de ${money(updated.targetAmount, goal.currency)}, ${updated.percentage}%)`;
    }

    case "delete_transaction": {
      const tx = a.ref ? c.recent[a.ref - 1] : undefined;
      if (!tx) throw new Error("no identifiqué el movimiento a borrar");
      await deleteTransaction(userId, tx.id);
      return `🗑️ Borré: ${money(tx.amount, tx.currency)} — ${tx.description ?? "movimiento"}`;
    }

    case "update_transaction": {
      const tx = a.ref ? c.recent[a.ref - 1] : undefined;
      if (!tx) throw new Error("no identifiqué el movimiento a editar");
      const txType = tx.type as "INCOME" | "EXPENSE" | "TRANSFER";
      const newCat =
        a.category !== undefined && (txType === "INCOME" || txType === "EXPENSE")
          ? findCategory(c, a.category, txType)
          : null;
      const newAcc = a.account !== undefined ? findAccount(c, a.account) : null;
      await updateTransaction(userId, tx.id, {
        type: tx.type,
        amount: a.amount ?? tx.amount,
        currency: tx.currency,
        description: a.description ?? tx.description ?? undefined,
        date: tx.date,
        categoryId: newCat?.id ?? tx.categoryId ?? undefined,
        accountId: newAcc?.id ?? tx.accountId ?? undefined,
        toAccountId: tx.toAccountId ?? undefined,
      });
      return `✏️ Actualicé: ${money(a.amount ?? tx.amount, tx.currency)} — ${a.description ?? tx.description ?? "movimiento"}`;
    }

    case "remember": {
      if (!a.fact) throw new Error("falta el dato a recordar");
      await addMemory(userId, a.fact);
      return `🧠 Anotado en tu memoria: ${a.fact}`;
    }

    case "create_task": {
      if (!hasFeature("tareas", { isTester: c.isTester })) throw new Error("esa función todavía no está disponible");
      if (!a.title) throw new Error("falta la tarea");
      const due = a.dueDate ? new Date(a.dueDate) : null;
      const validDue = due && !isNaN(due.getTime()) ? due : null;
      await createTask(userId, { title: a.title, dueDate: validDue });
      // Si tiene Google conectado, también la cargamos en Google Tasks.
      let enGoogle = false;
      if (hasFeature("google", { isTester: c.isTester }) && c.googleConnected) {
        enGoogle = (await createGoogleTask(userId, { title: a.title, due: validDue }).catch(() => ({ ok: false }))).ok;
      }
      return `✅ Anotado: ${a.title}${validDue ? ` (para el ${validDue.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })})` : ""}${enGoogle ? " · también en tu Google Tasks 📋" : ""}`;
    }

    case "complete_task": {
      if (!hasFeature("tareas", { isTester: c.isTester })) throw new Error("esa función todavía no está disponible");
      const t = a.taskRef ? c.tasks[a.taskRef - 1] : undefined;
      if (!t) throw new Error("no identifiqué la tarea");
      await toggleTask(userId, t.id);
      return `✅ Marqué como hecha: ${t.title}`;
    }

    case "delete_task": {
      if (!hasFeature("tareas", { isTester: c.isTester })) throw new Error("esa función todavía no está disponible");
      const t = a.taskRef ? c.tasks[a.taskRef - 1] : undefined;
      if (!t) throw new Error("no identifiqué la tarea");
      await deleteTask(userId, t.id);
      return `🗑️ Borré la tarea: ${t.title}`;
    }

    case "create_reminder": {
      if (!hasFeature("recordatorios", { isTester: c.isTester })) throw new Error("esa función todavía no está disponible");
      if (!a.title) throw new Error("falta qué recordar");
      let when: Date | null = null;
      if (a.inMinutes && a.inMinutes > 0) {
        when = new Date(Date.now() + a.inMinutes * 60_000);
      } else if (a.remindAt) {
        when = fromZonedTime(a.remindAt, ARG_TZ); // hora ARG → instante UTC
      }
      if (!when || isNaN(when.getTime())) throw new Error("no entendí para cuándo");
      if (when.getTime() < Date.now() - 60_000) throw new Error("esa hora ya pasó");

      await createReminder(userId, { text: a.title, remindAt: when });
      const label = toZonedTime(when, ARG_TZ);
      const sameDay = formatDateFn(label, "yyyy-MM-dd") === formatDateFn(toZonedTime(new Date(), ARG_TZ), "yyyy-MM-dd");
      const cuando = sameDay ? `hoy ${formatDateFn(label, "HH:mm")}` : formatDateFn(label, "dd/MM 'a las' HH:mm");
      return `⏰ Listo, te aviso ${cuando}: ${a.title}`;
    }

    case "agendar_evento": {
      if (!hasFeature("google", { isTester: c.isTester })) throw new Error("esa función todavía no está disponible");
      if (!c.googleConnected) throw new Error("primero conectá tu Google en Configuración → Google Calendar y Tareas");
      if (!a.title || !a.eventStart) throw new Error("falta el evento o la hora");
      const start = fromZonedTime(a.eventStart, ARG_TZ);
      if (isNaN(start.getTime())) throw new Error("no entendí la fecha/hora del evento");
      const dur = a.durationMin && a.durationMin > 0 ? a.durationMin : 60;
      const r = await createCalendarEvent(userId, { summary: a.title, start, end: new Date(start.getTime() + dur * 60_000) });
      if (!r.ok) throw new Error(r.error ?? "no pude crear el evento en tu Google Calendar");
      return `📅 Agendado en tu Google Calendar: ${a.title} — ${formatDateFn(toZonedTime(start, ARG_TZ), "dd/MM 'a las' HH:mm")}`;
    }

    default:
      throw new Error(a.type ? `acción no reconocida (${a.type})` : "no entendí bien qué querías hacer");
  }
}

/**
 * Procesa un mensaje entrante y devuelve el texto a responder por WhatsApp.
 */
export async function handleUserMessage(userId: string, message: string, imageUrl?: string): Promise<string> {
  const clean = message.trim();
  if (!clean && !imageUrl) return "No entendí el mensaje. Probá escribiendo, mandando un audio o una foto 🙂";

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [accounts, categories, summary, netWorth, debts, budgets, goals, investments, txPage, history, memory, isTester, allTasks, reminders, googleConnected] =
    await Promise.all([
      getAccounts(userId),
      getCategories(userId),
      getMonthSummary(userId),
      getNetWorth(userId).catch(() => null),
      getDebts(userId).catch(() => [] as SerializedDebt[]),
      getBudgets(userId, month, year).catch(() => [] as SerializedBudget[]),
      getGoals(userId).catch(() => [] as SerializedGoal[]),
      getInvestments(userId).catch(() => [] as SerializedInvestment[]),
      getTransactions(userId, { take: 15 }).catch(() => ({ items: [], total: 0, hasMore: false })),
      getChatHistory(userId).catch(() => [] as ChatTurn[]),
      getMemory(userId).catch(() => [] as string[]),
      getIsTester(userId).catch(() => false),
      getTasks(userId).catch(() => [] as SerializedTask[]),
      getPendingReminders(userId).catch(() => [] as SerializedReminder[]),
      getGoogleStatus(userId).then((s) => s.connected).catch(() => false),
    ]);

  // timeZone ARG explícito: sin esto el server (UTC) cree que es el día siguiente
  // entre las 21 y 24hs ARG, y el bot calcula mal "hoy"/"mañana".
  const today = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ARG_TZ });
  const monthLabel = now.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: ARG_TZ });

  const ctx: FinancialContext = {
    accounts,
    categories,
    summary,
    netWorth,
    debts,
    budgets,
    goals,
    investments,
    recent: txPage.items,
    memory,
    today,
    monthLabel,
    month,
    year,
    isTester,
    tasks: allTasks.filter((t) => !t.done),
    reminders,
    nowArg: formatDateFn(toZonedTime(now, ARG_TZ), "yyyy-MM-dd'T'HH:mm"),
    googleConnected,
  };

  const result = await interpret(clean, ctx, imageUrl, history);

  const reply = await buildReply(userId, result, ctx, now);

  // Guardamos el turno para que el bot recuerde la conversación.
  await saveChatTurn(userId, clean || "[imagen/audio]", reply);

  return reply;
}

/** Ejecuta las acciones (si las hay) y arma el texto de respuesta. */
async function buildReply(
  userId: string,
  result: AssistantOutput,
  ctx: FinancialContext,
  now: Date
): Promise<string> {
  if (result.intent !== "action" || result.actions.length === 0) {
    return result.answer || "Listo 👍";
  }

  const isoDate = now.toISOString();
  const lines: string[] = [];
  const errors: string[] = [];

  // Dedup: a veces el modelo emite la MISMA acción dos veces (sobre todo con
  // audio), lo que registraba el movimiento duplicado y respondía dos veces.
  // Filtramos acciones idénticas antes de ejecutarlas.
  const seen = new Set<string>();
  const actions = result.actions.filter((a) => {
    const sig = JSON.stringify([
      a.type,
      a.amount ?? null,
      a.currency ?? null,
      (a.description ?? "").toLowerCase().trim(),
      a.category ?? null,
      a.account ?? null,
      a.fromAccount ?? null,
      a.toAccount ?? null,
      a.personName ?? null,
      a.date ?? null,
      a.name ?? null,
      a.goalName ?? null,
      a.ref ?? null,
    ]);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });

  const clarifications: string[] = [];
  let duplicates = 0;
  for (const action of actions) {
    try {
      lines.push(await runAction(userId, action, ctx, isoDate));
    } catch (err) {
      if (err instanceof NeedsAccount) clarifications.push(err.message);
      else if (err instanceof AlreadyRegistered) duplicates++;
      else errors.push(err instanceof Error ? err.message : "error en una acción");
    }
  }

  // No se registró nada y solo falta saber la cuenta → preguntamos claro,
  // SIN rotular "✅ Hecho" (no se hizo nada todavía).
  if (lines.length === 0 && clarifications.length > 0) {
    return clarifications.length === 1
      ? clarifications[0]
      : `Necesito un dato para registrar:\n\n${clarifications.map((q) => `• ${q}`).join("\n")}`;
  }

  // Todo lo que mandó ya estaba registrado (re-emisión por un "sí"/"ok").
  if (lines.length === 0 && duplicates > 0 && errors.length === 0) {
    return "Eso ya lo tenía anotado ✅ — no lo dupliqué.";
  }

  if (lines.length === 0) {
    return errors.length
      ? `No pude completar la acción: ${errors[0]} 🙏`
      : 'No pude identificar la acción. Probá algo como: "gasté 5 lucas en el súper" 🙂';
  }

  let reply: string;
  if (lines.length === 1) {
    reply = lines[0];
  } else {
    // Varias acciones → lista con viñetas. Cada item puede ocupar 2 líneas; las
    // sangramos para que se lea como un bloque ordenado.
    const bullets = lines.map((l) => `• ${l.replace(/\n/g, "\n   ")}`).join("\n");
    reply = `✅ *Hecho:*\n\n${bullets}`;
  }

  // Nota conversacional del modelo (si aporta algo y no es un relleno trivial).
  // Guard anti-duplicado: a veces el modelo reescribe en "answer" el mismo
  // movimiento que la app ya confirmó (mismo monto). En ese caso la descartamos
  // para no responder dos veces lo mismo.
  const note = (result.answer ?? "").trim();
  const amountTokens = actions
    .filter((a): a is Action & { amount: number } => typeof a.amount === "number" && a.amount > 0)
    .map((a) => money(a.amount, a.currency === "USD" ? "USD" : "ARS"));
  const noteRestatesMovement = amountTokens.some((tok) => note.includes(tok));
  if (
    note &&
    note.length <= 180 &&
    !noteRestatesMovement &&
    !/^(listo|ok|dale|hecho|perfecto)\b/i.test(note)
  ) {
    reply += `\n\n${note}`;
  }

  // Movimientos registrados + alguno que todavía necesita cuenta.
  if (clarifications.length) reply += `\n\n${clarifications.join("\n")}`;
  if (errors.length) reply += `\n\n⚠️ No pude con: ${errors.join("; ")}`;
  return reply;
}
