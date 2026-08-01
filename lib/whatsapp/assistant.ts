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
import { getAccounts, createAccount, updateAccount, deleteAccount, type SerializedAccount } from "@/lib/db/accounts";
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
import { getDebts, createDebt, payDebt, deleteDebt, type SerializedDebt } from "@/lib/db/debts";
import { getBudgets, createOrUpdateBudget, deleteBudget, type SerializedBudget } from "@/lib/db/budgets";
import { getGoals, createGoal, addFundsToGoal, updateGoal, deleteGoal, type SerializedGoal } from "@/lib/db/goals";
import { getInvestments, type SerializedInvestment } from "@/lib/db/investments";
import { getTasks, toggleTask, deleteTask, type SerializedTask } from "@/lib/db/tasks";
import { createReminder, getPendingReminders, type SerializedReminder } from "@/lib/db/reminders";
import { createRecurringReminder, listRecurringReminders, updateRecurringReminder, deleteRecurringReminder, type SerializedRecurringReminder } from "@/lib/db/recurring-reminders";
import { isStudyOwner } from "@/lib/study/ingest";
import { listSubjects as listStudySubjects, listUnits as listStudyUnits, createUnit as createStudyUnit, createBlocksDistributed } from "@/lib/db/study-system";
import { createCalendarEvent, getGoogleStatus, listCalendarEvents, listGoogleTasks, deleteCalendarEvent, updateCalendarEvent, completeGoogleTask, type GoogleCalendarEvent } from "@/lib/google";
import { getIsTester } from "@/lib/db/profile";
import { hasFeature } from "@/lib/feature-flags";
import { ARG_TZ } from "@/lib/timezone";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { format as formatDateFn } from "date-fns";
// El día de la semana en la confirmación evita el error más común: que el
// usuario lea "07/08" y no registre que eso es un jueves.
import { es } from "date-fns/locale";
import { getChatHistory, saveChatTurn, getMemory, addMemory, clearAssistantMemory, type ChatTurn } from "@/lib/whatsapp/memory";
import { geminiEnabled, geminiChatJson, openaiChatJson, LlmError } from "@/lib/ai/chat";
import { notifyAdminThrottled, bumpDailyCounter } from "@/lib/alerts";
import { escalateSupport } from "@/lib/db/support";
import { todayStringArg } from "@/lib/timezone";
import { getCotizaciones, type CotizacionItem } from "@/lib/cotizaciones";
import { formatMarketReply, formatRatesForContext, parseMarketQuery } from "@/lib/whatsapp/market-data";
import { z } from "zod";
import { cancelPendingAction, hasPendingAction, savePendingAction, takePendingAction } from "@/lib/whatsapp/pending-action";
import { recordAgentEvent } from "@/lib/whatsapp/telemetry";
import { applyRulesToMovement, createAgentRule, deleteAgentRule, formatRulesForPrompt, listAgentRules, type AgentRule, type AgentRuleKind } from "@/lib/whatsapp/rules";
import { getProactiveInsights, type ProactiveInsight } from "@/lib/whatsapp/insights";
import { findFirstFreeSlot, formatOrganizerReply, overlappingEvents, parseOrganizerQuery } from "@/lib/whatsapp/organizer";
import { getOrganizerSettings, updateOrganizerSettings, type OrganizerSettings } from "@/lib/whatsapp/organizer-settings";
import { createHabit, createOrganizationList, createOrganizationTask, toggleHabitCompletion, updateOrganizationTask } from "@/lib/db/organization";
import { prisma } from "@/lib/prisma";
import { syncTaskToGoogle } from "@/lib/google-organization";
import { decrypt } from "@/lib/crypto";

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
  dueDate?: string;  // create_task: DIA EN QUE LO HACE (YYYY-MM-DD)
  deadline?: string; // create_task: dia en que VENCE (YYYY-MM-DD). Son cosas distintas.
  taskRef?: number; // complete_task / delete_task ([#N] de TUS TAREAS)
  inMinutes?: number; // create_reminder: dentro de X minutos
  remindAt?: string;  // create_reminder: fecha/hora exacta ARG "YYYY-MM-DDTHH:mm"
  daysOfWeek?: number[]; // create_recurring_reminder: días 0=Dom..6=Sáb (lun-vie = [1,2,3,4,5])
  atTime?: string;       // create_recurring_reminder: hora ARG "HH:mm"
  link?: string;         // create_recurring_reminder: link opcional que se manda con el aviso
  recRef?: number;       // edit_recurring_reminder / delete_recurring_reminder: [#N] de RECORDATORIOS RECURRENTES
  eventStart?: string; // agendar_evento / editar_evento: inicio ARG "YYYY-MM-DDTHH:mm"
  durationMin?: number; // agendar_evento / editar_evento: duración en minutos (default 60)
  eventRef?: number; // borrar_evento / editar_evento: [#N] de AGENDA
  motivo?: string;   // escalar_soporte: resumen del problema a derivar al equipo
  subjectCode?: string;     // create_study: código de la materia (debe existir)
  unit?: string;            // create_study: nombre de la unidad/capítulo
  topics?: string[];        // create_study: lista de temas de la unidad
  initialSessions?: number; // create_study: sesiones de estudio inicial (1-4)
  ruleKind?: AgentRuleKind;
  match?: string;
  value?: string;
  ruleRef?: number;
  allowConflict?: boolean;
  briefEnabled?: boolean;
  briefHour?: number;
  workStart?: number;
  workEnd?: number;
  focusMinutes?: number;
  bufferMinutes?: number;
  listName?: string;
  habitName?: string;
  status?: "TODO" | "IN_PROGRESS" | "DONE";
  priority?: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  urgent?: boolean;
  important?: boolean;
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
  recurringReminders: SerializedRecurringReminder[];
  nowArg: string; // "YYYY-MM-DDTHH:mm" hora Argentina (para recordatorios)
  dateRef: string; // tabla de los próximos días con su fecha exacta (ARG)
  googleConnected: boolean;
  gcalEvents: GoogleCalendarEvent[];
  gtasks: { id: string; title: string; due: string | null }[];
  referralUrl: string;
  isStudyOwner: boolean; // solo el dueño del estudio puede cargar materias/temas
  studySubjects: { code: string; name: string }[];
  marketRates: CotizacionItem[];
  rules: AgentRule[];
  proactiveInsights: ProactiveInsight[];
  organizerSettings: OrganizerSettings;
}

const assistantOutputSchema = z.object({
  intent: z.enum(["action", "query", "chat"]).catch("chat"),
  actions: z.array(z.object({
    type: z.string().min(1),
    amount: z.number().positive().optional(),
    currency: z.enum(["ARS", "USD"]).optional(),
    description: z.string().max(300).optional(),
    date: z.string().max(40).optional(),
    category: z.string().max(120).nullable().optional(),
    account: z.string().max(120).nullable().optional(),
    reportOnly: z.boolean().optional(),
    fromAccount: z.string().max(120).nullable().optional(),
    toAccount: z.string().max(120).nullable().optional(),
    name: z.string().max(200).optional(),
    accountType: z.string().max(60).optional(),
    balance: z.number().optional(),
    direction: z.enum(["i_owe", "they_owe"]).optional(),
    personName: z.string().max(200).optional(),
    targetAmount: z.number().positive().optional(),
    currentAmount: z.number().nonnegative().optional(),
    goalName: z.string().max(200).optional(),
    ref: z.coerce.number().int().positive().optional(),
    fact: z.string().max(500).optional(),
    title: z.string().max(500).optional(),
    dueDate: z.string().max(40).optional(),
    deadline: z.string().max(40).optional(),
    taskRef: z.coerce.number().int().positive().optional(),
    inMinutes: z.number().positive().max(525_600).optional(),
    remindAt: z.string().max(40).optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    atTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    link: z.string().url().max(1000).optional(),
    recRef: z.coerce.number().int().positive().optional(),
    eventStart: z.string().max(40).optional(),
    durationMin: z.number().positive().max(1440).optional(),
    eventRef: z.coerce.number().int().positive().optional(),
    motivo: z.string().max(600).optional(),
    subjectCode: z.string().max(40).optional(),
    unit: z.string().max(300).optional(),
    topics: z.array(z.string().max(500)).max(100).optional(),
    initialSessions: z.number().int().min(1).max(4).optional(),
    ruleKind: z.enum(["MERCHANT_CATEGORY", "MERCHANT_ACCOUNT", "DEFAULT_ACCOUNT"]).optional(),
    match: z.string().max(160).optional(),
    value: z.string().max(160).optional(),
    ruleRef: z.coerce.number().int().positive().optional(),
    allowConflict: z.boolean().optional(),
    briefEnabled: z.boolean().optional(),
    briefHour: z.number().int().min(0).max(23).optional(),
    workStart: z.number().int().min(0).max(23).optional(),
    workEnd: z.number().int().min(1).max(24).optional(),
    focusMinutes: z.number().int().min(15).max(240).optional(),
    bufferMinutes: z.number().int().min(0).max(120).optional(),
    listName: z.string().max(120).optional(),
    habitName: z.string().max(160).optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
    priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional(),
    urgent: z.boolean().optional(),
    important: z.boolean().optional(),
  }).strict()).max(50),
  answer: z.string().max(4000).catch(""),
}).strict();

function stripModelNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripModelNulls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, item]) => item !== null || ["category", "account", "fromAccount", "toAccount"].includes(key))
      .map(([key, item]) => [key, stripModelNulls(item)])
  );
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

/** Parsea un ref [#N] que puede venir como número o string ("[#2]", "#2", "2"). */
function refNum(v: unknown): number {
  if (typeof v === "number") return v;
  const m = String(v ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

/** Match genérico por nombre (metas, presupuestos, etc.). */
function findByName<T extends { name: string }>(list: T[], q: string | null | undefined): T | null {
  if (!q) return null;
  const n = norm(q);
  return list.find((x) => norm(x.name) === n) ?? list.find((x) => norm(x.name).includes(n)) ?? null;
}


// ─────────────────────────── Contexto para el LLM ───────────────────────────

function formatFinancialState(c: FinancialContext): string {
  const s: string[] = [];

  s.push(`COTIZACIONES ACTUALES (DolarAPI, no inventar ni usar conocimiento propio):\n${formatRatesForContext(c.marketRates)}`);

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

  if (hasFeature("recordatorios", { isTester: c.isTester }) && c.recurringReminders.length) {
    const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
    s.push(
      `RECORDATORIOS RECURRENTES (usá el número [#N] como "recRef" para editar/borrar):\n` +
        c.recurringReminders
          .slice(0, 15)
          .map((r, i) => {
            const days =
              r.daysOfWeek.length === 7
                ? "todos los días"
                : r.daysOfWeek.length === 5 && [1, 2, 3, 4, 5].every((d) => r.daysOfWeek.includes(d))
                  ? "Lun-Vie"
                  : r.daysOfWeek.slice().sort((a, b) => a - b).map((d) => DIAS[d]).join("");
            const t = `${String(r.hour).padStart(2, "0")}:${String(r.minute).padStart(2, "0")}`;
            return `[#${i + 1}] ${r.text} — ${days} ${t}${r.link ? " (con link)" : ""}${r.isActive ? "" : " [pausado]"}`;
          })
          .join("\n")
    );
  }

  if (c.gcalEvents.length) {
    s.push(
      `AGENDA — GOOGLE CALENDAR (próximos 7 días, usá [#N] como "eventRef" para borrar/editar):\n` +
        c.gcalEvents
          .slice(0, 20)
          .map((e, i) => {
            // start puede ser dateTime (con hora) o date (todo el día).
            const hasTime = e.start.includes("T");
            const d = new Date(e.start);
            const label = isNaN(d.getTime())
              ? e.start
              : hasTime
                ? formatDateFn(toZonedTime(d, ARG_TZ), "dd/MM HH:mm")
                : formatDateFn(d, "dd/MM");
            return `[#${i + 1}] ${label}: ${e.summary}`;
          })
          .join("\n")
    );
  }

  if (c.gtasks.length) {
    s.push(
      `GOOGLE TASKS (pendientes):\n` +
        c.gtasks
          .slice(0, 20)
          .map((t) => {
            const due = t.due ? ` (vence ${formatDateFn(new Date(t.due), "dd/MM")})` : "";
            return `- ${t.title}${due}`;
          })
          .join("\n")
    );
  }

  if (c.isStudyOwner) {
    s.push(
      c.studySubjects.length
        ? `TUS MATERIAS DE ESTUDIO (usá el "code" en create_study):\n` +
            c.studySubjects.map((m) => `- ${m.code}: ${m.name}`).join("\n")
        : `ESTUDIO: todavía no tenés materias creadas. Si te piden cargar una unidad/temas, avisá que primero hay que crear la materia en la sección Estudio de la app.`
    );
  }

  s.push(`REGLAS PERSONALES:\n${formatRulesForPrompt(c.rules)}`);
  if (c.proactiveInsights.length) {
    s.push(
      `INSIGHTS CALCULADOS:\n` +
      c.proactiveInsights.map((insight) => `- ${insight.title}: ${insight.message.replaceAll("*", "")}`).join("\n")
    );
  }
  s.push(
    `PREFERENCIAS DE ORGANIZACIÓN:\n` +
    `- Jornada ${String(c.organizerSettings.workStart).padStart(2, "0")}:00–${String(c.organizerSettings.workEnd).padStart(2, "0")}:00\n` +
    `- Bloque de foco: ${c.organizerSettings.focusMinutes} min · margen: ${c.organizerSettings.bufferMinutes} min\n` +
    `- Resumen diario: ${c.organizerSettings.briefEnabled ? `activo a las ${String(c.organizerSettings.briefHour).padStart(2, "0")}:00` : "desactivado"}`
  );

  return s.join("\n\n");
}

async function interpret(
  message: string,
  c: FinancialContext,
  imageUrl?: string,
  history: ChatTurn[] = []
): Promise<AssistantOutput> {
  const expenseCats = c.categories.filter((x) => x.type === "EXPENSE").map((x) => x.name);
  const incomeCats = c.categories.filter((x) => x.type === "INCOME").map((x) => x.name);

  const system = `Sos el asistente personal de "control.io" por WhatsApp: un ASESOR FINANCIERO experto
(Argentina) Y un asistente capaz para el DÍA A DÍA. Hablás como una persona real —cálido, argentino,
cercano y práctico, sin jerga— en mensajes cortos tipo WhatsApp. Transmitís seguridad y confianza, y
tu norte es que el usuario SIEMPRE se vaya con una respuesta útil, pregunte lo que pregunte. Hoy es ${c.today}.${hasFeature("recordatorios", { isTester: c.isTester }) || (hasFeature("google", { isTester: c.isTester }) && c.googleConnected) ? `
FECHAS EXACTAS (Argentina) — usá ESTAS, no calcules a mano: ${c.dateRef}. Ahora son las ${c.nowArg.slice(11)}.` : ""}
Moneda por defecto: ARS.

EXPERTISE FINANCIERA — cuando te preguntan o piden análisis, DIAGNOSTICÁS con los DATOS REALES del
usuario (los de abajo) y das recomendaciones CONCRETAS y accionables, nunca genéricas. Dominás:
- Presupuesto y ahorro: regla 50/30/20 (necesidades/gustos/ahorro-deuda), tasa de ahorro saludable
  (>20% de ingresos), fondo de emergencia (3-6 meses de gastos), automatizar el ahorro, cortar
  gastos hormiga, presupuestar por categoría, "pagarte a vos primero".
- Deudas y crédito: "bola de nieve" (saldar la más chica primero, motiva) vs "avalancha" (la de
  mayor interés, óptima) — recomendá según el caso; ojo con el CFT de tarjetas/préstamos y con
  pagar el mínimo; cuándo conviene refinanciar/unificar.
- Contexto argentino (inflación alta → proteger el excedente): plazo fijo tradicional y UVA, dólar
  (oficial/MEP/blue y la brecha), FCI money market, CEDEARs, bonos, crypto (con cautela y solo lo
  que puedas perder). Nociones de monotributo y sus categorías, ganancias y bienes personales a
  alto nivel. SIEMPRE como ORIENTACIÓN GENERAL, no asesoramiento de inversión formal: no digas
  "comprá X", explicá las opciones y sus pros/contras para que el usuario decida mejor.

ALCANCE ESPECIALIZADO — sos el agente de control.io para finanzas personales, cotizaciones,
presupuestos, ahorro, organización, agenda y soporte del producto. No sos un asistente de IA
generalista. Si preguntan algo totalmente ajeno, respondé amable y breve y orientá la conversación
a cómo podés ayudar con sus finanzas u organización. En salud, derecho o impuestos específicos,
limitá la respuesta a orientación general y sugerí consultar a un profesional.

ORGANIZADOR PERSONAL EXPERTO — Google Calendar, Google Tasks, tareas de control.io y recordatorios
son la fuente de verdad. Nunca inventes disponibilidad. Aplicá estos principios:
- Diferenciá evento (hora fija), tarea (resultado pendiente) y recordatorio (aviso puntual).
- Priorizá por urgencia e impacto; proponé como máximo 3 prioridades principales por día.
- Convertí trabajo importante en bloques de foco realistas, con pausas y margen entre compromisos.
- Antes de agendar verificá conflictos; no superpongas salvo que el usuario insista explícitamente.
- Si una jornada está sobrecargada, decilo y proponé mover, reducir o delegar, sin prometer magia.
- Para "organizame el día/semana", combiná agenda + tareas + vencimientos y ordená cronológicamente.
- Después de una reunión importante, sugerí una tarea breve de seguimiento solo si aporta valor.
- La disponibilidad siempre se calcula con inicio Y fin reales de cada evento.

SOPORTE TÉCNICO DE control.io — TAMBIÉN sos el soporte de la app: si el usuario pregunta CÓMO se usa
algo, DÓNDE está una función o algo NO le funciona, resolvele la duda con pasos claros y cortos.
NUNCA lo dejes sin solución: explicá el paso a paso; y si no alcanza (hay un error/bug, algo roto, o
pide hablar con una persona), emití la acción "escalar_soporte" y avisale que lo derivaste. Conocés la app:
• QUÉ ES: control.io es un gestor de finanzas personales. Se usa por acá (WhatsApp) y por la web
  (controlio.site); lo que cargás en un lado aparece en el otro.
• CARGAR GASTOS/INGRESOS por WhatsApp: escribí el movimiento ("gasté 3000 en el súper"), mandá un
  AUDIO, o la FOTO de un ticket — se registra solo.
• VINCULAR WHATSAPP: en la web, en Inicio, tocá "Vincular WhatsApp" (abre este chat con un código;
  con un toque quedás vinculado). Si un número no está vinculado, no se le puede cargar nada.
• CUENTAS: en "Cuentas" creás Efectivo, Mercado Pago, banco, etc. Para fijar el saldo real, decí
  "en Mercado Pago tengo 50.000". Cada gasto/ingreso real necesita una cuenta.
• MOVIMIENTOS: en "Movimientos" se ve y edita todo lo cargado.
• PLANIFICÁ: Presupuestos (tope por categoría), Metas (objetivos de ahorro) y Recordatorios
  recurrentes (avisos que se repiten).
• ORGANIZACIÓN: Calendario y Tareas; si conecta Google, también su agenda de Google Calendar.
• DEUDAS y CUOTAS: lo que debés/te deben y las cuotas de tarjeta. GRUPOS: gastos compartidos.
• ANÁLISIS: Reporte, Tendencias y Gastos hormiga. COTIZACIONES: dólar (oficial/MEP/blue). NEWSLETTER:
  resumen automático de tus finanzas.
• COTIZACIONES EN WHATSAPP: si pregunta "a cuánto está el dólar" o cualquier cotización, respondé
  el valor completo ACÁ MISMO con compra y venta usando COTIZACIONES ACTUALES. NUNCA lo mandes a
  la web para conocer el valor y nunca respondas solo con un enlace.
• NOTIFICACIONES: para recibir avisos/recordatorios, instalá la app (en el navegador → "Agregar a
  pantalla de inicio") y permití notificaciones.
• PRIVACIDAD: los datos están cifrados y son privados de cada usuario.
Si no sabés algo con certeza del sistema o el usuario reporta que algo falla, NO inventes: escalá con
"escalar_soporte" { motivo } y decile que el equipo lo va a contactar.

HONESTIDAD: nunca inventes NÚMEROS del usuario (usá solo los del sistema de abajo) ni datos que no
sabés con certeza. Si falta info, pedila corta. Confianza en el tono, cero invento en los hechos.
Respuestas BREVES (es WhatsApp), claras y útiles.

INVITACIÓN (usar con MUCHA moderación): SOLO cuando le acabás de dar un dato que claramente lo
sorprendió o le fue muy útil (un "wow": "gastaste $X en delivery este mes", un ahorro logrado, un
insight fuerte), PODÉS cerrar con UNA línea corta invitando a compartir control.io — ej: "Si conocés
a alguien que vive diciendo que no sabe en qué se le va la plata, pasale esto 👉 ${c.referralUrl}".
NUNCA lo hagas en saludos, confirmaciones, cargas normales, ni dos veces seguidas. Si dudás, no invites.

También EJECUTÁS acciones: registrar gastos/ingresos, transferencias, crear cuentas, deudas,
presupuestos, metas, tareas, recordatorios y eventos, editar/borrar movimientos, y recordar datos.

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
EXCEPCIÓN: si una REGLA PERSONAL de comercio→cuenta o cuenta predeterminada resuelve la cuenta,
emití la acción sin preguntar; el ejecutor aplicará esa regla automáticamente.

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
- Si contiene [CLASIFICACIÓN_VISUAL: COMPROBANTE_FINANCIERO], la imagen ES FINANCIERA de forma vinculante. PROHIBIDO tratarla como material de estudio o preguntar de qué materia es. Extraé el movimiento y generá expense/income/transfer según corresponda.
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
- "rename_account": { account, name }   // RENOMBRAR una cuenta existente ("cambiale el nombre a X", "la cuenta Y llamala Z"). account = cuenta actual, name = nombre nuevo.
- "delete_account": { account }         // BORRAR una cuenta ("borrá la cuenta X", "eliminá X"). account = una de las cuentas existentes.
- "create_debt": { direction: "i_owe"|"they_owe", personName, amount, currency, description }
- "pay_debt": { personName, amount }
- "delete_debt": { personName }         // BORRAR una deuda ("borrá la deuda con Juan", "sacá lo que le debo a X"). personName = de la lista DEUDAS.
- "create_budget": { category, amount }                        // categoría de gasto, mes actual
- "delete_budget": { category }         // BORRAR un presupuesto ("sacá el presupuesto de Comida"). category = categoría del presupuesto (de la lista PRESUPUESTOS).
- "create_goal": { name, targetAmount, currency, currentAmount }
- "add_to_goal": { goalName, amount }
- "update_goal": { goalName, name, targetAmount }   // EDITAR una meta ("cambiale el objetivo a X", "la meta Y llamala Z"). goalName = meta actual (de la lista METAS). name = nombre nuevo (opcional), targetAmount = objetivo nuevo (opcional).
- "delete_goal": { goalName }           // BORRAR una meta ("borrá la meta del auto", "eliminá X"). goalName = de la lista METAS.
- "delete_transaction": { ref }                                // ref = número [#N] de la lista
- "update_transaction": { ref, amount, description, category, account }  // solo los campos a cambiar
- "remember": { fact }   // guardar un DATO DURABLE del usuario (cómo es su plata/vida: "cobro los días 10", "mi alquiler es 200k"). NO es una tarea.
- "create_rule": { ruleKind, match, value } // regla durable: MERCHANT_CATEGORY comercio→categoría; MERCHANT_ACCOUNT comercio→cuenta; DEFAULT_ACCOUNT todos→cuenta.
- "delete_rule": { ruleRef } // desactivar una regla [#N] de REGLAS PERSONALES.
- "clear_memory": {} // borrar memoria, historial y reglas cuando el usuario pide "olvidá todo lo que sabés de mí". Requiere confirmación.
- Si dice "Coto siempre es Supermercado", "Uber siempre sale de Mercado Pago" o "usá Efectivo por defecto", creá una regla; no uses solo remember.
- "escalar_soporte": { motivo }   // DERIVAR al equipo humano de soporte cuando NO podés resolver una duda del SISTEMA, el usuario reporta un ERROR/bug o algo roto, o pide hablar con una persona. motivo = resumen corto del problema. Primero SIEMPRE intentá resolverlo vos con los pasos; usá esto solo si de verdad no alcanza. Tras emitirlo, "answer" avisa que se derivó.
${hasFeature("tareas", { isTester: c.isTester }) ? `- "create_task": { title, dueDate, deadline, eventStart, durationMin, listName, priority, urgent, important } // crea un pendiente.
  OJO con las dos fechas, son distintas: dueDate = EL DIA EN QUE LO VA A HACER ("lo hago el jueves", "mañana", "el 7");
  deadline = EL DIA EN QUE VENCE, solo si lo dice explicito ("vence el 10", "tengo hasta el 15", "para el viernes a mas tardar").
  Si solo menciona un dia sin hablar de vencimiento, va en dueDate. Si tiene hora, eventStart="YYYY-MM-DDTHH:mm" y se sincroniza con Google Calendar.
- "complete_task": { taskRef, title }   // marcar una tarea como HECHA ("marcá comprar pan como hecha", "ya entregué el TP", "listo lo de las pilas"). Pasá taskRef = [#N] de TUS TAREAS PENDIENTES, Y TAMBIÉN title = el texto de la tarea (ej: "comprar pan"). Siempre mandá title.
- "update_task": { taskRef, title, dueDate, eventStart, durationMin, listName, status, priority, urgent, important } // reprograma, mueve de lista o cambia prioridad/estado.
- "delete_task": { taskRef }   // borrar/cancelar una tarea. taskRef = [#N] de TUS TAREAS PENDIENTES.
- "create_list": { listName } // crea una lista de organización.
- "create_habit": { habitName, daysOfWeek, atTime } // crea un hábito.
- "complete_habit": { habitName, date } // marca el hábito cumplido; date YYYY-MM-DD, hoy si se omite.
Todo lo de organización se refleja en la app. Una tarea con horario se refleja también en Google Calendar.` : ``}
${hasFeature("recordatorios", { isTester: c.isTester }) ? `- "create_reminder": { title, inMinutes, remindAt }   // recordatorio CON HORA que te aviso UNA SOLA VEZ ("haceme acordar en 5 min de sacar la comida", "recordame mañana a las 9 llamar al banco"). title = qué recordar. Para "en X minutos/horas" usá inMinutes (5, 120). Para una hora/fecha puntual usá remindAt "YYYY-MM-DDTHH:mm" en hora Argentina (calculada desde AHORA). Es distinto de create_task: el recordatorio DISPARA un aviso a una hora exacta.
- "create_recurring_reminder": { title, daysOfWeek, atTime, link }   // recordatorio que SE REPITE ("recordame todos los lunes a viernes a las 17:00 sacar la basura", "todos los días a las 21 cargá tus gastos", "cada lunes a las 9 pagar el alquiler"). title = qué recordar. daysOfWeek = array de días donde 0=Domingo,1=Lunes,2=Martes,3=Miércoles,4=Jueves,5=Viernes,6=Sábado (ej: lunes a viernes = [1,2,3,4,5]; todos los días = [0,1,2,3,4,5,6]; fin de semana = [0,6]). atTime = hora ARG "HH:mm" (ej "17:00"). link = URL opcional que se manda JUNTO al aviso (ej: link de asistencia de la facultad). Usalo SIEMPRE que el pedido tenga una repetición ("todos", "cada", "los lunes", "de lunes a viernes"). Distinto de create_reminder (que es una sola vez).
  ⚠️ LINK: si el usuario quiere adjuntar un link pero TODAVÍA NO lo pasó ("quiero dejar un link", "con un link"), NO crees el recordatorio aún: respondé intent "chat" pidiéndoselo ("Dale, pasame el link y lo dejo listo 👍"). En el PRÓXIMO mensaje (lo vas a ver en el HISTORIAL con los datos del recordatorio pendiente) creá el recordatorio con ese "link". Si el usuario ya incluyó el link en el mismo mensaje, ponelo directo en "link".
- "edit_recurring_reminder": { recRef, title, daysOfWeek, atTime, link }   // EDITAR un recordatorio recurrente existente ("cambiá el de asistencia a las 20", "el recordatorio de la basura ponelo también los sábados", "agregale este link al de asistencia: ..."). recRef = [#N] de RECORDATORIOS RECURRENTES. Mandá SOLO los campos que cambian. Para quitar el link mandá link:"".
- "delete_recurring_reminder": { recRef }   // BORRAR un recordatorio recurrente ("borrá el recordatorio de asistencia", "sacá el de la basura"). recRef = [#N] de RECORDATORIOS RECURRENTES.` : ``}
${hasFeature("google", { isTester: c.isTester }) && c.googleConnected ? `- "agendar_evento": { title, eventStart, durationMin, allowConflict }   // crea un EVENTO en Google Calendar y verifica conflictos. allowConflict=true SOLO si el usuario insiste explícitamente después de ser avisado. eventStart = "YYYY-MM-DDTHH:mm" en hora Argentina.
- "plan_task": { title, dueDate, durationMin } // busca automáticamente el primer hueco libre antes del vencimiento y crea un bloque de foco en Google Calendar. durationMin opcional; usa la preferencia de foco si se omite.
- "configure_organizer": { briefEnabled, briefHour, workStart, workEnd, focusMinutes, bufferMinutes } // configura jornada, foco, margen y resumen diario. Mandá solo lo pedido.
- "borrar_evento": { eventRef }   // borra un evento del calendario ("borrá la reunión del lunes", "cancelá el turno"). eventRef = [#N] de AGENDA.
- "editar_evento": { eventRef, title, eventStart, durationMin }   // reprograma o renombra un evento ("movélo a las 16", "cambialo para el martes 11hs"). eventRef = [#N] de AGENDA. Mandá solo lo que cambia (title y/o eventStart).` : ``}
${c.isStudyOwner ? `- "create_study": { subjectCode, unit, topics, initialSessions }   // CARGAR UNA UNIDAD + SUS TEMAS en el sistema de Estudio. Solo para pedidos explícitos de estudio o [CLASIFICACIÓN_VISUAL: MATERIAL_DE_ESTUDIO]. NUNCA para [CLASIFICACIÓN_VISUAL: COMPROBANTE_FINANCIERO]. subjectCode = código de una de TUS MATERIAS. unit = nombre de la unidad/capítulo. topics = array con cada tema leído exactamente, sin inventar. initialSessions opcional (1-4).
  ⚠️ La clasificación COMPROBANTE_FINANCIERO tiene prioridad absoluta. Solo preguntá la materia cuando sea MATERIAL_DE_ESTUDIO y no resulte identificable.` : ``}
REGLAS:
- "intent":"action" cuando hay que ejecutar algo (llená "actions"). Podés poner varias acciones.
- "intent":"query" para preguntas de finanzas, cotizaciones, organización, agenda o uso de control.io: "actions" vacío y respuesta útil. Si es financiera, usá los datos reales. Si es totalmente ajena al alcance, contestá brevemente y ofrecé ayuda dentro de finanzas u organización.
- "intent":"chat" para saludos, charla suelta o confirmaciones ("hola", "gracias", "dale", "listo"): "actions" vacío, "answer" cordial y breve. Si el saludo trae una pregunta real, tratala como "query" y respondela.
${hasFeature("recordatorios", { isTester: c.isTester }) ? `- ⚠️ CRÍTICO: si el usuario pide que le RECUERDES o le AVISES algo ("haceme acordar", "recordame", "avisame en 5 min", "avisame mañana a las 9"), es SIEMPRE intent "action" con UNA acción create_reminder. PROHIBIDO responder solo con texto como "te recordaré en 2 minutos" o "dale, te aviso" — eso NO programa nada y el recordatorio NO existe. TENÉS que emitir la acción: { "type": "create_reminder", "title": "<qué recordar>", "inMinutes": <N> } para "en N minutos/horas", o "remindAt":"YYYY-MM-DDTHH:mm" para una hora puntual. Ejemplo — usuario: "haceme acordar en 2 min de tomar agua" → {"intent":"action","actions":[{"type":"create_reminder","title":"tomar agua","inMinutes":2}],"answer":""}. Y si REPITE — usuario: "recordame todos los lunes a viernes a las 17:00 sacar la basura" → {"intent":"action","actions":[{"type":"create_recurring_reminder","title":"sacar la basura","daysOfWeek":[1,2,3,4,5],"atTime":"17:00"}],"answer":""}` : ``}
${hasFeature("tareas", { isTester: c.isTester }) ? `- Si el usuario pide ANOTAR un pendiente sin hora ("anotá comprar pilas", "tengo que llamar al banco"), es intent "action" con create_task — NO lo prometas por texto.
- ORGANIZACIÓN: si te preguntan qué tienen que hacer ("qué tengo que hacer", "mis tareas", "qué me falta", "qué tengo el lunes/mañana/esta semana", "cómo viene mi semana"), es intent "query". Armá la respuesta combinando TODO lo que tengas en el contexto: TUS TAREAS PENDIENTES + RECORDATORIOS PROGRAMADOS + AGENDA (Google Calendar) + GOOGLE TASKS. Si preguntan por un día puntual, filtrá a ESE día (usá la tabla de FECHAS EXACTAS para saber qué fecha es). Respondé ordenado por hora/fecha, cortito. Si no hay nada para ese día, decíselo.` : ``}
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
- Usá *negrita* con UN solo asterisco para montos y totales. NUNCA uses **doble asterisco** ni # títulos markdown: WhatsApp NO los renderiza y quedan feos.
- Aunque el tema dé para largo (finanzas, organización, recetas), respondé conciso: lo esencial primero; si el usuario quiere más, que lo pida.
- Frases cortas. Si listás varias cosas, una por línea empezando con "• ".
- Nada de párrafos largos: máximo ~6 líneas, salvo que pidan más detalle.
- Un emoji al inicio de un bloque está bien; no abuses ni uses tablas.`;

  const userText = imageUrl
    ? (message || "Interpretá esta imagen (ticket/recibo/captura) y registrá los gastos o ingresos que veas.")
    : message;
  const input = { system, history, userText, imageDataUrl: imageUrl };

  // Gemini (gratis) como PRINCIPAL; si se satura/falla, respaldo OpenAI-compatible
  // (OpenRouter/OpenAI) para que ningún usuario quede sin respuesta.
  let content: string;
  if (geminiEnabled()) {
    try {
      content = await geminiChatJson(input);
    } catch (e) {
      await onGeminiFallback(e).catch(() => {});
      content = await openaiChatJson(input);
    }
  } else {
    content = await openaiChatJson(input);
  }

  let parsed: AssistantOutput;
  try {
    parsed = assistantOutputSchema.parse(stripModelNulls(JSON.parse(content))) as AssistantOutput;
  } catch {
    throw new Error("El modelo no devolvió una respuesta estructurada válida");
  }

  return {
    intent: parsed.intent ?? "chat",
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    answer: typeof parsed.answer === "string" ? parsed.answer : "",
  };
}

/**
 * Gemini se saturó (429) o falló: registra el evento del día y avisa al admin
 * (con throttle) que el bot pasó a OpenRouter y conviene cargar créditos.
 */
async function onGeminiFallback(e: unknown): Promise<void> {
  const status = e instanceof LlmError ? e.status : 0;
  const isQuota = status === 429;
  const n = await bumpDailyCounter(isQuota ? "gemini_quota" : "gemini_error", todayStringArg()).catch(() => 0);
  const title = isQuota ? "⚠️ Gemini llegó al límite gratis" : "⚠️ Gemini falló";
  const body = `El bot pasó a OpenRouter de respaldo para no dejar sin respuesta a los usuarios.${isQuota ? " (Gemini agotó el cupo gratuito de hoy/este minuto)." : ""} Van ${n} veces hoy. Si sigue, cargá créditos.`;
  // 429 avisa cada 60 min; otros errores cada 30 (para no spamear).
  await notifyAdminThrottled(isQuota ? "alert_gemini_quota" : "alert_gemini_error", isQuota ? 60 : 30, title, body).catch(() => {});
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
      applyRulesToMovement(a, c.rules);
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

    case "create_rule": {
      if (!a.ruleKind || !a.value) throw new Error("falta completar la regla");
      const match = a.ruleKind === "DEFAULT_ACCOUNT" ? (a.match || "todos") : a.match;
      if (!match) throw new Error("falta indicar cuándo aplicar la regla");
      await createAgentRule(userId, a.ruleKind, match, a.value);
      c.rules = await listAgentRules(userId);
      return `🧠 Regla guardada: ${match} → ${a.value}`;
    }

    case "delete_rule": {
      if (!a.ruleRef) throw new Error("falta el número de regla");
      await deleteAgentRule(userId, a.ruleRef);
      c.rules = await listAgentRules(userId);
      return `🗑️ Desactivé la regla [#${a.ruleRef}]`;
    }

    case "clear_memory": {
      await clearAssistantMemory(userId);
      c.memory = [];
      c.rules = [];
      return "🧹 Borré tu memoria, historial conversacional y reglas personales.";
    }

    case "create_task": {
      if (!hasFeature("tareas", { isTester: c.isTester })) throw new Error("esa función todavía no está disponible");
      if (!a.title) throw new Error("falta la tarea");
      // "Cuándo lo hago" y "cuándo vence" son campos distintos. Un día suelto
      // ("el jueves") es cuándo lo hace, no un vencimiento: mezclarlos hacía que
      // todo lo que tuviera fecha apareciera siempre en Hoy.
      const deadline = a.deadline ? new Date(a.deadline) : null;
      const validDeadline = deadline && !isNaN(deadline.getTime()) ? deadline : null;
      const start = a.eventStart ? fromZonedTime(a.eventStart, ARG_TZ) : null;
      const timedStart = start && !isNaN(start.getTime()) ? start : null;
      // Sin hora, la tarea queda reservada para ese día: scheduledEnd null es la
      // marca de "sin hora" y evita crear un evento en Google que nadie pidió.
      const dayOnly = !timedStart && a.dueDate ? fromZonedTime(`${a.dueDate}T00:00`, ARG_TZ) : null;
      const validDayOnly = dayOnly && !isNaN(dayOnly.getTime()) ? dayOnly : null;
      const list = a.listName ? await prisma.organizationList.findFirst({
        where: { userId, name: { equals: a.listName, mode: "insensitive" } },
      }) : null;
      const task = await createOrganizationTask(userId, {
        title: a.title,
        dueDate: validDeadline,
        scheduledStart: timedStart ?? validDayOnly,
        scheduledEnd: timedStart ? new Date(timedStart.getTime() + (a.durationMin ?? 60) * 60_000) : null,
        listId: list?.id ?? null,
        priority: a.priority,
        urgent: a.urgent,
        important: a.important,
      });
      let enGoogle = false;
      if (task.scheduledEnd && c.googleConnected) {
        enGoogle = await syncTaskToGoogle(userId, task.id).then(() => true).catch(() => false);
      }
      // Siempre se confirma lo que se entendió: sin eso, la captura rápida se
      // vuelve una fuente de errores silenciosos que nadie detecta.
      const cuando = timedStart
        ? ` · ${formatDateFn(toZonedTime(timedStart, ARG_TZ), "EEEE dd/MM 'a las' HH:mm", { locale: es })}`
        : validDayOnly
          ? ` · ${formatDateFn(toZonedTime(validDayOnly, ARG_TZ), "EEEE dd/MM", { locale: es })}`
          : "";
      const vence = validDeadline
        ? ` · vence ${formatDateFn(toZonedTime(validDeadline, ARG_TZ), "dd/MM", { locale: es })}`
        : "";
      return `✅ Anotado: ${a.title}${cuando}${vence}${enGoogle ? " · en Google Calendar" : ""}`;
    }

    case "update_task": {
      const task = a.taskRef ? c.tasks[a.taskRef - 1] : undefined;
      if (!task) throw new Error("no identifiqué la tarea");
      const start = a.eventStart ? fromZonedTime(a.eventStart, ARG_TZ) : undefined;
      const due = a.dueDate ? new Date(a.dueDate) : undefined;
      const list = a.listName ? await prisma.organizationList.findFirst({
        where: { userId, name: { equals: a.listName, mode: "insensitive" } },
      }) : undefined;
      await updateOrganizationTask(userId, task.id, {
        ...(a.title ? { title: a.title } : {}),
        ...(due && !isNaN(due.getTime()) ? { dueDate: due } : {}),
        ...(start && !isNaN(start.getTime()) ? {
          scheduledStart: start,
          scheduledEnd: new Date(start.getTime() + (a.durationMin ?? 60) * 60_000),
        } : {}),
        ...(a.listName ? { listId: list?.id ?? null } : {}),
        ...(a.status ? { status: a.status } : {}),
        ...(a.priority ? { priority: a.priority } : {}),
        ...(a.urgent !== undefined ? { urgent: a.urgent } : {}),
        ...(a.important !== undefined ? { important: a.important } : {}),
      });
      if (start && c.googleConnected) await syncTaskToGoogle(userId, task.id).catch(() => null);
      return `✏️ Actualicé la tarea: ${a.title ?? task.title}`;
    }

    case "create_list": {
      if (!a.listName) throw new Error("falta el nombre de la lista");
      await createOrganizationList(userId, a.listName);
      return `📁 Creé la lista *${a.listName}*.`;
    }

    case "create_habit": {
      if (!a.habitName) throw new Error("falta el nombre del hábito");
      await createHabit(userId, {
        name: a.habitName,
        daysOfWeek: a.daysOfWeek ?? [],
        scheduledTime: a.atTime ?? null,
      });
      return `🔥 Creé el hábito *${a.habitName}*.`;
    }

    case "complete_habit": {
      if (!a.habitName) throw new Error("falta el hábito");
      const habits = await prisma.habit.findMany({ where: { userId, isActive: true } });
      const habit = habits.find((h) => norm(decrypt(h.name) ?? h.name).includes(norm(a.habitName!)));
      if (!habit) throw new Error("no encontré ese hábito");
      const completedOn = a.date ? new Date(`${a.date.slice(0, 10)}T12:00:00Z`) : new Date();
      const completed = await toggleHabitCompletion(userId, habit.id, completedOn);
      return completed ? `✅ Marqué *${a.habitName}* como cumplido.` : `↩️ Quité la marca de *${a.habitName}*.`;
    }

    case "create_study": {
      if (!c.isStudyOwner) throw new Error("el sistema de estudio es solo del dueño");
      const code = (a.subjectCode ?? "").trim();
      const unitName = (a.unit ?? "").trim();
      const topics = (a.topics ?? []).map((t) => String(t).trim()).filter(Boolean);
      if (!code) throw new Error("no me quedó claro a qué materia va. Decime la materia y lo cargo.");
      if (topics.length === 0) throw new Error("no leí ningún tema para cargar. Reenviame la foto o pasámelos por texto.");
      const subs = await listStudySubjects(userId);
      const subject =
        subs.find((s) => s.code.toLowerCase() === code.toLowerCase()) ??
        subs.find((s) => s.name.toLowerCase().includes(code.toLowerCase()));
      if (!subject) throw new Error(`no encontré la materia "${code}". Creala en la app (Estudio → Materias) y lo cargo.`);
      let unitId: string | undefined;
      if (unitName) {
        const existing = (await listStudyUnits(userId, subject.id)).find((u) => u.name.toLowerCase() === unitName.toLowerCase());
        unitId = existing ? existing.id : (await createStudyUnit(userId, { subjectId: subject.id, name: unitName })).id;
      }
      const created = await createBlocksDistributed(
        userId, subject.id, 1,
        topics.map((t) => ({ topic: t, unitId: unitId ?? null, initialSessions: a.initialSessions })),
      );
      const unitLabel = unitName ? ` en "${unitName}"` : "";
      return `📚 Cargué ${created.length} tema${created.length === 1 ? "" : "s"}${unitLabel} de ${subject.code} y los repartí en tus días. Los ves en la app → Estudio.`;
    }

    case "complete_task": {
      if (!hasFeature("tareas", { isTester: c.isTester })) throw new Error("esa función todavía no está disponible");
      // Título a buscar: lo que pidió el usuario o el de la tarea referida por [#N].
      const titleQ = norm(a.title ?? (a.taskRef ? c.tasks[a.taskRef - 1]?.title ?? "" : ""));
      // Prefiere coincidencia EXACTA; si no hay, usa "contiene". Completa TODAS
      // las que coincidan (así se limpian duplicados de las pruebas).
      const matchAll = <T extends { title: string }>(arr: T[]): T[] => {
        if (!titleQ) return [];
        const exact = arr.filter((x) => norm(x.title) === titleQ);
        return exact.length ? exact : arr.filter((x) => norm(x.title).includes(titleQ));
      };

      let internas = matchAll(c.tasks);
      if (!internas.length && a.taskRef && c.tasks[a.taskRef - 1]) internas = [c.tasks[a.taskRef - 1]];

      const gMatches =
        hasFeature("google", { isTester: c.isTester }) && c.googleConnected ? matchAll(c.gtasks) : [];

      if (!internas.length && !gMatches.length) throw new Error("no identifiqué la tarea");

      for (const x of internas) await toggleTask(userId, x.id);
      for (const g of gMatches) await completeGoogleTask(userId, g.id).catch(() => {});

      const total = internas.length + gMatches.length;
      const nombre = internas[0]?.title ?? gMatches[0]?.title ?? a.title;
      return `✅ Marqué como hecha: ${nombre}${total > 1 ? ` (${total} en total)` : ""}`;
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

    case "create_recurring_reminder": {
      if (!hasFeature("recordatorios", { isTester: c.isTester })) throw new Error("esa función todavía no está disponible");
      if (!a.title) throw new Error("falta qué recordar");
      const days = Array.isArray(a.daysOfWeek)
        ? [...new Set(a.daysOfWeek)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [];
      if (days.length === 0) throw new Error("no entendí qué días");
      const m = /^(\d{1,2}):(\d{2})$/.exec(a.atTime ?? "");
      if (!m) throw new Error("no entendí a qué hora");
      const hour = Math.min(23, Math.max(0, parseInt(m[1], 10)));
      const minute = Math.min(59, Math.max(0, parseInt(m[2], 10)));

      await createRecurringReminder(userId, { text: a.title, daysOfWeek: days, hour, minute, link: a.link });
      const DÍAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
      const dl =
        days.length === 7 ? "todos los días"
        : days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d)) ? "de lunes a viernes"
        : days.slice().sort((x, y) => x - y).map((d) => DÍAS[d]).join(", ");
      const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      return `🔁 Listo, te voy a recordar ${dl} a las ${hhmm}: ${a.title}`;
    }

    case "edit_recurring_reminder": {
      const idx = refNum(a.recRef) - 1;
      const rr = c.recurringReminders[idx];
      if (!rr) throw new Error("no encontré ese recordatorio recurrente");
      const patch: { text?: string; daysOfWeek?: number[]; hour?: number; minute?: number; link?: string | null } = {};
      if (a.title) patch.text = a.title;
      if (Array.isArray(a.daysOfWeek) && a.daysOfWeek.length) {
        patch.daysOfWeek = [...new Set(a.daysOfWeek)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      }
      const m = /^(\d{1,2}):(\d{2})$/.exec(a.atTime ?? "");
      if (m) { patch.hour = Math.min(23, Math.max(0, parseInt(m[1], 10))); patch.minute = Math.min(59, Math.max(0, parseInt(m[2], 10))); }
      if (a.link !== undefined) patch.link = a.link || null;
      await updateRecurringReminder(userId, rr.id, patch);
      return `✏️ Listo, actualicé el recordatorio: ${patch.text ?? rr.text}`;
    }

    case "delete_recurring_reminder": {
      const rr = c.recurringReminders[refNum(a.recRef) - 1];
      if (!rr) throw new Error("no encontré ese recordatorio recurrente");
      await deleteRecurringReminder(userId, rr.id);
      return `🗑️ Borré el recordatorio: ${rr.text}`;
    }

    case "update_goal": {
      const g = findByName(c.goals, a.goalName ?? a.name);
      if (!g) throw new Error("no encontré esa meta");
      const patch: { name?: string; targetAmount?: number } = {};
      if (a.name && a.name !== g.name) patch.name = a.name;
      if (a.targetAmount != null) patch.targetAmount = a.targetAmount;
      if (!patch.name && patch.targetAmount == null) throw new Error("no entendí qué cambiar de la meta");
      await updateGoal(userId, g.id, patch);
      return `✏️ Listo, actualicé la meta ${patch.name ?? g.name}${patch.targetAmount != null ? ` (objetivo ${money(patch.targetAmount, g.currency)})` : ""}`;
    }

    case "delete_goal": {
      const g = findByName(c.goals, a.goalName ?? a.name);
      if (!g) throw new Error("no encontré esa meta");
      await deleteGoal(userId, g.id);
      return `🗑️ Borré la meta: ${g.name}`;
    }

    case "delete_debt": {
      const d = c.debts.find((x) => !x.isCompleted && norm(x.personName) === norm(a.personName ?? "")) ??
        c.debts.find((x) => norm(x.personName).includes(norm(a.personName ?? "")));
      if (!d) throw new Error("no encontré esa deuda");
      await deleteDebt(userId, d.id);
      return `🗑️ Borré la deuda con ${d.personName}`;
    }

    case "delete_budget": {
      const cat = findCategory(c, a.category, "EXPENSE");
      const b = cat ? c.budgets.find((x) => x.categoryId === cat.id) : findByName(c.budgets.map((x) => ({ id: x.id, name: x.categoryName })), a.category);
      if (!b) throw new Error("no encontré ese presupuesto");
      await deleteBudget(userId, b.id);
      return `🗑️ Borré el presupuesto`;
    }

    case "delete_account": {
      const acc = findAccount(c, a.account ?? a.name);
      if (!acc) throw new Error("no encontré esa cuenta");
      await deleteAccount(userId, acc.id);
      return `🗑️ Borré la cuenta ${acc.name}`;
    }

    case "rename_account": {
      const acc = findAccount(c, a.account);
      if (!acc) throw new Error("no encontré esa cuenta");
      if (!a.name) throw new Error("no entendí el nuevo nombre");
      await updateAccount(userId, acc.id, { name: a.name });
      return `✏️ Listo, renombré la cuenta a ${a.name}`;
    }

    case "agendar_evento": {
      if (!hasFeature("google", { isTester: c.isTester })) throw new Error("esa función todavía no está disponible");
      if (!c.googleConnected) throw new Error("primero conectá tu Google en Configuración → Google Calendar y Tareas");
      if (!a.title || !a.eventStart) throw new Error("falta el evento o la hora");
      const start = fromZonedTime(a.eventStart, ARG_TZ);
      if (isNaN(start.getTime())) throw new Error("no entendí la fecha/hora del evento");
      const dur = a.durationMin && a.durationMin > 0 ? a.durationMin : 60;
      const end = new Date(start.getTime() + Math.min(dur, 24 * 60) * 60_000);
      const conflicts = overlappingEvents(
        await listCalendarEvents(userId, { from: start, to: end }),
        start,
        end
      );
      if (conflicts.length && !a.allowConflict) {
        throw new Error(`ese horario se superpone con "${conflicts[0].summary}". Elegí otro horario o decime que lo agende igual`);
      }
      const r = await createCalendarEvent(userId, { summary: a.title, start, end });
      if (!r.ok) throw new Error(r.error ?? "no pude crear el evento en tu Google Calendar");
      return `📅 Agendado en tu Google Calendar: ${a.title} — ${formatDateFn(toZonedTime(start, ARG_TZ), "dd/MM 'a las' HH:mm")}`;
    }

    case "plan_task": {
      if (!c.googleConnected) throw new Error("primero conectá Google Calendar");
      if (!a.title) throw new Error("falta la tarea a planificar");
      const from = new Date();
      const due = a.dueDate
        ? fromZonedTime(`${a.dueDate.slice(0, 10)}T${String(c.organizerSettings.workEnd).padStart(2, "0")}:00`, ARG_TZ)
        : new Date(from.getTime() + 7 * 86_400_000);
      if (isNaN(due.getTime()) || due <= from) throw new Error("el vencimiento debe ser futuro");
      const events = await listCalendarEvents(userId, { from, to: due });
      const duration = a.durationMin ?? c.organizerSettings.focusMinutes;
      const slot = findFirstFreeSlot(events, from, due, duration, c.organizerSettings);
      if (!slot) throw new Error("no encontré un hueco suficiente antes del vencimiento");
      const r = await createCalendarEvent(userId, {
        summary: `Foco: ${a.title}`,
        start: slot.start,
        end: slot.end,
      });
      if (!r.ok) throw new Error(r.error ?? "no pude crear el bloque de foco");
      return `🎯 Bloqueé *${a.title}* el ${formatDateFn(toZonedTime(slot.start, ARG_TZ), "dd/MM 'de' HH:mm")} a ${formatDateFn(toZonedTime(slot.end, ARG_TZ), "HH:mm")} en Google Calendar.`;
    }

    case "configure_organizer": {
      c.organizerSettings = await updateOrganizerSettings(userId, {
        ...(a.briefEnabled !== undefined ? { briefEnabled: a.briefEnabled } : {}),
        ...(a.briefHour !== undefined ? { briefHour: a.briefHour } : {}),
        ...(a.workStart !== undefined ? { workStart: a.workStart } : {}),
        ...(a.workEnd !== undefined ? { workEnd: a.workEnd } : {}),
        ...(a.focusMinutes !== undefined ? { focusMinutes: a.focusMinutes } : {}),
        ...(a.bufferMinutes !== undefined ? { bufferMinutes: a.bufferMinutes } : {}),
      });
      return `⚙️ Organizador actualizado: jornada ${c.organizerSettings.workStart}:00–${c.organizerSettings.workEnd}:00, foco ${c.organizerSettings.focusMinutes} min, margen ${c.organizerSettings.bufferMinutes} min${c.organizerSettings.briefEnabled ? `, resumen a las ${c.organizerSettings.briefHour}:00` : ""}.`;
    }

    case "borrar_evento": {
      if (!hasFeature("google", { isTester: c.isTester }) || !c.googleConnected) throw new Error("primero conectá tu Google");
      const ev = a.eventRef ? c.gcalEvents[a.eventRef - 1] : undefined;
      if (!ev) throw new Error("no identifiqué el evento a borrar");
      const r = await deleteCalendarEvent(userId, ev.id);
      if (!r.ok) throw new Error(r.error ?? "no pude borrar el evento");
      return `🗑️ Borré el evento: ${ev.summary}`;
    }

    case "editar_evento": {
      if (!hasFeature("google", { isTester: c.isTester }) || !c.googleConnected) throw new Error("primero conectá tu Google");
      const ev = a.eventRef ? c.gcalEvents[a.eventRef - 1] : undefined;
      if (!ev) throw new Error("no identifiqué el evento a editar");
      const patch: { summary?: string; start?: Date; end?: Date } = {};
      if (a.title) patch.summary = a.title;
      if (a.eventStart) {
        const start = fromZonedTime(a.eventStart, ARG_TZ);
        if (isNaN(start.getTime())) throw new Error("no entendí la nueva fecha/hora");
        const dur = a.durationMin && a.durationMin > 0 ? a.durationMin : 60;
        patch.start = start;
        patch.end = new Date(start.getTime() + dur * 60_000);
      }
      if (!patch.summary && !patch.start) throw new Error("no entendí qué cambiar del evento");
      const r = await updateCalendarEvent(userId, ev.id, patch);
      if (!r.ok) throw new Error(r.error ?? "no pude editar el evento");
      const cuando = patch.start ? ` — ${formatDateFn(toZonedTime(patch.start, ARG_TZ), "dd/MM 'a las' HH:mm")}` : "";
      return `✏️ Listo, actualicé el evento: ${patch.summary ?? ev.summary}${cuando}`;
    }

    case "escalar_soporte": {
      const motivo = (a.motivo || a.description || "consulta de soporte").toString().slice(0, 400);
      await escalateSupport(userId, motivo).catch(() => {});
      return "🆘 Listo, lo derivé al equipo de soporte de control.io — te van a contactar para resolverlo. Si mientras tanto puedo ayudarte con otra cosa, decime 👍";
    }

    default:
      throw new Error(a.type ? `acción no reconocida (${a.type})` : "no entendí bien qué querías hacer");
  }
}

/**
 * Procesa un mensaje entrante y devuelve el texto a responder por WhatsApp.
 */
export async function handleUserMessage(userId: string, message: string, imageUrl?: string): Promise<string> {
  const startedAt = Date.now();
  const clean = message.trim();
  if (!clean && !imageUrl) return "No entendí el mensaje. Probá escribiendo, mandando un audio o una foto 🙂";

  const normalizedReply = norm(clean);
  const wantsCancel = /^(cancelar|cancela|no|mejor no|olvidalo)$/.test(normalizedReply);
  if (wantsCancel && await hasPendingAction(userId).catch(() => false)) {
    await cancelPendingAction(userId).catch(() => {});
    const reply = "Listo, cancelé la operación. No cambié nada 👍";
    await saveChatTurn(userId, clean, reply);
    await recordAgentEvent({ userId, event: "pending_cancelled", latencyMs: Date.now() - startedAt }).catch(() => {});
    return reply;
  }
  const wantsConfirm = /^(confirmar|confirmo|si confirmar|si hacelo|si hacele|dale confirmar)$/.test(normalizedReply);

  // Las cotizaciones son datos vivos: se contestan desde la misma fuente y caché
  // que usa la web, sin pedirle al LLM que recuerde o estime valores.
  const marketQuery = !imageUrl ? parseMarketQuery(clean) : null;
  if (marketQuery) {
    const rates = await getCotizaciones().catch(() => [] as CotizacionItem[]);
    const marketReply = formatMarketReply(marketQuery, rates);
    if (marketReply) {
      await saveChatTurn(userId, clean, marketReply);
      await recordAgentEvent({
        userId,
        event: "market_query",
        intent: "query",
        latencyMs: Date.now() - startedAt,
      }).catch(() => {});
      return marketReply;
    }
  }

  // Disponibilidad y agenda siempre se responden desde Google Calendar,
  // consultando exactamente el intervalo pedido y sin delegar hechos al LLM.
  const organizerQuery = !imageUrl ? parseOrganizerQuery(clean, new Date()) : null;
  if (organizerQuery) {
    const status = await getGoogleStatus(userId).catch(() => ({ connected: false, email: null }));
    if (!status.connected) {
      const reply = "📅 Para consultar tu disponibilidad real, conectá Google Calendar en *Configuración → Google Calendar y Tareas*.";
      await saveChatTurn(userId, clean, reply);
      return reply;
    }
    let events: GoogleCalendarEvent[];
    try {
      events = await listCalendarEvents(userId, {
        from: organizerQuery.from,
        to: organizerQuery.to,
      });
    } catch {
      const reply = "⚠️ No pude verificar tu Google Calendar ahora. No voy a asumir que estás libre. Reconectá Google desde Configuración o probá nuevamente en un momento.";
      await saveChatTurn(userId, clean, reply);
      return reply;
    }
    const reply = formatOrganizerReply(organizerQuery, events);
    await saveChatTurn(userId, clean, reply);
    await recordAgentEvent({
      userId,
      event: "organizer_query",
      intent: "query",
      latencyMs: Date.now() - startedAt,
    }).catch(() => {});
    return reply;
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [accounts, categories, summary, netWorth, debts, budgets, goals, investments, txPage, history, memory, isTester, allTasks, reminders, recurringReminders, googleConnected, marketRates, rules, proactiveInsights, organizerSettings] =
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
      listRecurringReminders(userId).catch(() => [] as SerializedRecurringReminder[]),
      getGoogleStatus(userId).then((s) => s.connected).catch(() => false),
      getCotizaciones().catch(() => [] as CotizacionItem[]),
      listAgentRules(userId).catch(() => [] as AgentRule[]),
      getProactiveInsights(userId).catch(() => [] as ProactiveInsight[]),
      getOrganizerSettings(userId),
    ]);

  // timeZone ARG explícito: sin esto el server (UTC) cree que es el día siguiente
  // entre las 21 y 24hs ARG, y el bot calcula mal "hoy"/"mañana".
  const today = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ARG_TZ });
  const monthLabel = now.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: ARG_TZ });

  // Tabla de fechas exactas (ARG) para que el modelo no calcule a mano y no se
  // equivoque de día. en-CA da el formato YYYY-MM-DD.
  const dateRef = Array.from({ length: 15 }, (_, i) => {
    const d = new Date(now.getTime() + i * 86_400_000);
    const wd = d.toLocaleDateString("es-AR", { weekday: "long", timeZone: ARG_TZ });
    const iso = d.toLocaleDateString("en-CA", { timeZone: ARG_TZ });
    const tag = i === 0 ? "HOY " : i === 1 ? "MAÑANA " : "";
    return `${tag}${wd} ${iso}`;
  }).join(" · ");

  // Si tiene Google conectado, traemos su agenda (eventos + tasks) para poder
  // responder "¿qué tengo el lunes?" y demás consultas de organización.
  let gcalEvents: GoogleCalendarEvent[] = [];
  let gtasks: { id: string; title: string; due: string | null }[] = [];
  if (googleConnected && hasFeature("google", { isTester })) {
    [gcalEvents, gtasks] = await Promise.all([
      listCalendarEvents(userId, { daysAhead: 7 }).catch(() => []),
      listGoogleTasks(userId).catch(() => []),
    ]);
  }

  // Estudio: solo el dueño puede cargar materias/unidades/temas por WhatsApp.
  const studyOwner = await isStudyOwner(userId).catch(() => false);
  const studySubjects = studyOwner
    ? (await listStudySubjects(userId).catch(() => [])).map((s) => ({ code: s.code, name: s.name }))
    : [];

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
    recurringReminders,
    nowArg: formatDateFn(toZonedTime(now, ARG_TZ), "yyyy-MM-dd'T'HH:mm"),
    dateRef,
    googleConnected,
    gcalEvents,
    gtasks,
    referralUrl: `https://controlio.site/?ref=${userId}`,
    isStudyOwner: studyOwner,
    studySubjects,
    marketRates,
    rules,
    proactiveInsights,
    organizerSettings,
  };

  let result: AssistantOutput;
  if (wantsConfirm) {
    const pending = await takePendingAction(userId).catch(() => null);
    if (!pending) {
      const reply = "No hay ninguna operación pendiente para confirmar.";
      await saveChatTurn(userId, clean, reply);
      return reply;
    }
    result = {
      intent: "action",
      actions: pending.actions as Action[],
      answer: pending.answer,
    };
  } else {
    result = await interpret(clean, ctx, imageUrl, history);
  }

  const requireSourceConfirmation =
    !!imageUrl && result.actions.length > 1 ||
    clean.startsWith("[DOCUMENTO_FINANCIERO:");
  const reply = await buildReply(userId, result, ctx, now, wantsConfirm, requireSourceConfirmation);

  // Guardamos el turno para que el bot recuerde la conversación.
  await saveChatTurn(userId, clean || "[imagen/audio]", reply);
  await recordAgentEvent({
    userId,
    event: wantsConfirm ? "pending_confirmed" : "message_processed",
    intent: result.intent,
    actionTypes: result.actions.map((action) => action.type),
    latencyMs: Date.now() - startedAt,
  }).catch(() => {});

  return reply;
}

/** Ejecuta las acciones (si las hay) y arma el texto de respuesta. */
async function buildReply(
  userId: string,
  result: AssistantOutput,
  ctx: FinancialContext,
  now: Date,
  confirmed = false,
  requireSourceConfirmation = false
): Promise<string> {
  if (result.intent !== "action" || result.actions.length === 0) {
    return result.answer || "Listo 👍";
  }

  const sensitive = result.actions.filter((action) =>
    action.type.startsWith("delete_") ||
    action.type.startsWith("borrar_") ||
    action.type === "delete" ||
    action.type === "clear_memory" ||
    action.type === "transfer" ||
    action.type === "set_balance"
  );
  if (!confirmed && (sensitive.length > 0 || requireSourceConfirmation)) {
    await savePendingAction(userId, { actions: result.actions, answer: result.answer });
    const descriptions = (sensitive.length ? sensitive : result.actions).slice(0, 8).map((action) => {
      if (action.type === "transfer") {
        return `transferir ${money(action.amount ?? 0, action.currency)} de ${action.fromAccount ?? "una cuenta"} a ${action.toAccount ?? "otra cuenta"}`;
      }
      if (action.type === "set_balance") {
        return `fijar el saldo de ${action.account ?? "la cuenta"} en ${money(action.balance ?? 0, action.currency)}`;
      }
      if (action.type === "expense" || action.type === "income") {
        return `${action.type === "expense" ? "registrar gasto" : "registrar ingreso"} de ${money(action.amount ?? 0, action.currency)} · ${action.description ?? "sin descripción"}`;
      }
      return `ejecutar ${action.type.replaceAll("_", " ")}`;
    });
    if (result.actions.length > 8) descriptions.push(`y ${result.actions.length - 8} movimientos más`);
    return (
      `⚠️ Antes de hacerlo, necesito tu confirmación:\n\n` +
      descriptions.map((text) => `• ${text}`).join("\n") +
      `\n\nRespondé *CONFIRMAR* para continuar o *CANCELAR*. Vence en 15 minutos.`
    );
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
