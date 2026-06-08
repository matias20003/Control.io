/**
 * Cerebro del asistente de WhatsApp.
 *
 * - Interpreta mensajes en lenguaje natural (texto o audio transcripto).
 * - Registra gastos/ingresos.
 * - Responde consultas sobre TODO el estado financiero (saldos, movimientos,
 *   deudas, presupuestos, metas, inversiones, patrimonio neto) con datos reales.
 *
 * Variables de entorno:
 *   OPENAI_API_KEY   → clave del proveedor (OpenAI / OpenRouter / Groq)
 *   OPENAI_BASE_URL  → opcional, default https://api.openai.com/v1
 *   CHAT_MODEL       → opcional, default "gpt-4o-mini"
 */
import { getAccounts, type SerializedAccount } from "@/lib/db/accounts";
import { getCategories, type SerializedCategory } from "@/lib/db/categories";
import {
  createTransaction,
  getMonthSummary,
  getTransactions,
  type MonthSummary,
  type SerializedTransaction,
} from "@/lib/db/transactions";
import { getNetWorth, type NetWorth } from "@/lib/db/insights";
import { getDebts, type SerializedDebt } from "@/lib/db/debts";
import { getBudgets, type SerializedBudget } from "@/lib/db/budgets";
import { getGoals, type SerializedGoal } from "@/lib/db/goals";
import { getInvestments, type SerializedInvestment } from "@/lib/db/investments";

type Intent = "register" | "query" | "chat";

interface ExtractedItem {
  type: "INCOME" | "EXPENSE";
  amount: number;
  currency: "ARS" | "USD";
  description: string;
  category: string | null;
  account: string | null;
}

interface AssistantOutput {
  intent: Intent;
  items: ExtractedItem[];
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
  today: string;
  monthLabel: string;
}

function baseUrl(): string {
  return (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
}

/** Quita acentos y pasa a minúsculas para comparar nombres. */
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

/** Arma el bloque de "estado financiero" con datos reales para el LLM. */
function formatFinancialState(c: FinancialContext): string {
  const sections: string[] = [];

  sections.push(
    `CUENTAS Y SALDOS:\n` +
      (c.accounts.length
        ? c.accounts.map((a) => `- ${a.name} (${a.type}): ${money(a.balance, a.currency)}`).join("\n")
        : "- (sin cuentas)")
  );

  if (c.netWorth) {
    sections.push(
      `PATRIMONIO NETO (ARS): activos ${money(c.netWorth.totalAssets)}, pasivos ${money(
        c.netWorth.totalLiabilities
      )}, neto ${money(c.netWorth.netWorth)}`
    );
  }

  const cats = c.summary.byCategory.map((b) => `${b.name} ${money(b.total)}`).join(", ");
  sections.push(
    `RESUMEN ${c.monthLabel.toUpperCase()}: ingresos ${money(c.summary.totalIncome)}, gastos ${money(
      c.summary.totalExpense
    )}, balance ${money(c.summary.balance)}` + (cats ? `\nGastos por categoría: ${cats}` : "")
  );

  if (c.recent.length) {
    sections.push(
      `ÚLTIMOS MOVIMIENTOS:\n` +
        c.recent
          .slice(0, 15)
          .map((t) => {
            const d = new Date(t.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
            const sign = t.type === "INCOME" ? "+" : t.type === "EXPENSE" ? "-" : "";
            const cat = t.categoryName ? ` · ${t.categoryName}` : "";
            const acc = t.accountName ? ` (${t.accountName})` : "";
            return `- ${d} ${sign}${money(t.amount, t.currency)} ${t.description ?? ""}${cat}${acc}`.trim();
          })
          .join("\n")
    );
  }

  const openDebts = c.debts.filter((d) => !d.isCompleted);
  if (openDebts.length) {
    sections.push(
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
    sections.push(
      `PRESUPUESTOS (${c.monthLabel}):\n` +
        c.budgets
          .map((b) => `- ${b.categoryName}: gastado ${money(b.spent)} de ${money(b.amount)} (${b.percentage}%)`)
          .join("\n")
    );
  }

  if (c.goals.length) {
    sections.push(
      `METAS:\n` +
        c.goals
          .map(
            (g) =>
              `- ${g.name}: ${money(g.currentAmount, g.currency)} de ${money(g.targetAmount, g.currency)} (${g.percentage}%)`
          )
          .join("\n")
    );
  }

  if (c.investments.length) {
    sections.push(
      `INVERSIONES:\n` +
        c.investments
          .map((i) => {
            const val = i.currentValue != null ? `, valor actual ${money(i.currentValue, i.currency)}` : "";
            return `- ${i.name} (${i.type}): invertido ${money(i.amount, i.currency)}${val}`;
          })
          .join("\n")
    );
  }

  return sections.join("\n\n");
}

/** Llama al LLM y devuelve la interpretación estructurada del mensaje. */
async function interpret(message: string, c: FinancialContext): Promise<AssistantOutput> {
  const apiKey = process.env.OPENAI_API_KEY ?? fail("OPENAI_API_KEY no configurada");
  const model = process.env.CHAT_MODEL ?? "gpt-4o-mini";

  const expenseCats = c.categories.filter((x) => x.type === "EXPENSE").map((x) => x.name);
  const incomeCats = c.categories.filter((x) => x.type === "INCOME").map((x) => x.name);

  const system = `Sos el asistente financiero de "control.io", una app de finanzas personales argentina.
Hoy es ${c.today}. La moneda por defecto es ARS (pesos argentinos).

Tu trabajo:
1) Si el usuario informa gastos/ingresos → registralos (intent "register").
2) Si pregunta CUALQUIER cosa sobre sus finanzas → respondé con los DATOS REALES de abajo (intent "query").
3) Saludos o fuera de tema → intent "chat".

═══════════ ESTADO FINANCIERO DEL USUARIO (datos reales del sistema) ═══════════
${formatFinancialState(c)}
═══════════════════════════════════════════════════════════════════════════════

CATEGORÍAS de gasto disponibles: ${expenseCats.join(", ") || "ninguna"}
CATEGORÍAS de ingreso disponibles: ${incomeCats.join(", ") || "ninguna"}

Reglas para montos en jerga argentina:
- "5 lucas"/"5 luca"/"5k" = 5000. "un palo" = 1.000.000. "500 mangos" = 500.
- Sin aclaración de moneda → ARS. Si dicen "dólares"/"usd"/"verdes" → currency "USD".

Respondé SIEMPRE en JSON válido con esta forma exacta:
{
  "intent": "register" | "query" | "chat",
  "items": [
    { "type": "EXPENSE"|"INCOME", "amount": number, "currency": "ARS"|"USD", "description": string, "category": string|null, "account": string|null }
  ],
  "answer": string
}

- "register": uno o más gastos/ingresos. Llená "items". "category" SOLO de las listas (la que mejor encaje) o null. "account" SOLO de las cuentas si la menciona, sino null. "answer" = confirmación breve.
- "query": preguntas sobre saldos, gastos, deudas, presupuestos, metas, inversiones, patrimonio, movimientos, etc. "items" vacío. En "answer" respondé de forma BREVE, clara y concreta usando los datos de arriba. Mostrá montos con $ y separadores de miles. Si te piden algo que no está en los datos, decilo con honestidad.
- "chat": "items" vacío, "answer" cordial recordando que podés registrar movimientos y responder sobre sus finanzas.

NUNCA inventes datos ni movimientos que el usuario no mencionó. Usá solo los datos reales de arriba.`;

  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: message },
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
    items: Array.isArray(parsed.items) ? parsed.items : [],
    answer: typeof parsed.answer === "string" ? parsed.answer : "",
  };
}

/**
 * Procesa un mensaje entrante de un usuario y devuelve el texto a responder por WhatsApp.
 * Crea los movimientos en la base de datos cuando corresponde.
 */
export async function handleUserMessage(userId: string, message: string): Promise<string> {
  const clean = message.trim();
  if (!clean) return "No entendí el mensaje. Probá escribiendo o mandando un audio con el gasto o ingreso 🙂";

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [accounts, categories, summary, netWorth, debts, budgets, goals, investments, txPage] = await Promise.all([
    getAccounts(userId),
    getCategories(userId),
    getMonthSummary(userId),
    getNetWorth(userId).catch(() => null),
    getDebts(userId).catch(() => [] as SerializedDebt[]),
    getBudgets(userId, month, year).catch(() => [] as SerializedBudget[]),
    getGoals(userId).catch(() => [] as SerializedGoal[]),
    getInvestments(userId).catch(() => [] as SerializedInvestment[]),
    getTransactions(userId, { take: 15 }).catch(() => ({ items: [], total: 0, hasMore: false })),
  ]);

  const today = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const monthLabel = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const result = await interpret(clean, {
    accounts,
    categories,
    summary,
    netWorth,
    debts,
    budgets,
    goals,
    investments,
    recent: txPage.items,
    today,
    monthLabel,
  });

  if (result.intent !== "register" || result.items.length === 0) {
    return result.answer || "Listo 👍";
  }

  // Cuenta por defecto: preferimos efectivo (CASH), sino la primera activa.
  const defaultAccount = accounts.find((a) => a.type === "CASH") ?? accounts[0] ?? null;
  const isoDate = new Date().toISOString();

  const lines: string[] = [];
  let created = 0;

  for (const item of result.items) {
    if (!item.amount || item.amount <= 0 || (item.type !== "EXPENSE" && item.type !== "INCOME")) continue;

    // Mapear categoría por nombre (solo del tipo correcto).
    const cat = item.category
      ? categories.find((x) => x.type === item.type && norm(x.name) === norm(item.category!)) ??
        categories.find((x) => x.type === item.type && norm(x.name).includes(norm(item.category!)))
      : null;

    // Mapear cuenta por nombre, sino la default.
    const acc = item.account
      ? accounts.find((a) => norm(a.name) === norm(item.account!)) ??
        accounts.find((a) => norm(a.name).includes(norm(item.account!))) ??
        defaultAccount
      : defaultAccount;

    await createTransaction(userId, {
      type: item.type,
      amount: item.amount,
      currency: item.currency === "USD" ? "USD" : "ARS",
      description: item.description || (item.type === "EXPENSE" ? "Gasto" : "Ingreso"),
      date: isoDate,
      categoryId: cat?.id,
      accountId: acc?.id,
      notes: "Registrado por WhatsApp",
    });

    created++;
    const emoji = item.type === "EXPENSE" ? "🔴" : "🟢";
    const signo = item.type === "EXPENSE" ? "-" : "+";
    const cur = item.currency === "USD" ? "USD" : "$";
    const catTxt = cat ? ` · ${cat.icon ?? ""} ${cat.name}` : "";
    const accTxt = acc ? ` (${acc.name})` : "";
    lines.push(
      `${emoji} ${signo}${cur}${fmt(item.amount)} — ${item.description || (item.type === "EXPENSE" ? "Gasto" : "Ingreso")}${catTxt}${accTxt}`
    );
  }

  if (created === 0) {
    return 'No pude identificar un monto válido. Probá algo como: "gasté 5 lucas en el súper" 🙂';
  }

  const header = created === 1 ? "✅ Registrado:" : `✅ Registré ${created} movimientos:`;
  return `${header}\n\n${lines.join("\n")}`;
}
