/**
 * Cerebro del asistente de WhatsApp.
 *
 * Interpreta un mensaje en lenguaje natural (texto ya transcripto si vino de audio),
 * extrae los movimientos a registrar y/o responde consultas sobre las finanzas.
 *
 * Variables de entorno:
 *   OPENAI_API_KEY   → clave de OpenAI
 *   OPENAI_BASE_URL  → opcional, default https://api.openai.com/v1
 *   CHAT_MODEL       → opcional, default "gpt-4o-mini"
 */
import { getAccounts } from "@/lib/db/accounts";
import { getCategories } from "@/lib/db/categories";
import { createTransaction, getMonthSummary } from "@/lib/db/transactions";

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

function baseUrl(): string {
  return (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
}

/** Quita acentos y pasa a minúsculas para comparar nombres. */
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .trim();
}

function fmt(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
}

function fail(msg: string): never {
  throw new Error(msg);
}

/** Llama al LLM y devuelve la interpretación estructurada del mensaje. */
async function interpret(
  message: string,
  context: {
    accounts: { name: string; type: string; balance: number; currency: string }[];
    categories: { name: string; type: string }[];
    summary: { totalIncome: number; totalExpense: number; balance: number };
    today: string;
  }
): Promise<AssistantOutput> {
  const apiKey = process.env.OPENAI_API_KEY ?? fail("OPENAI_API_KEY no configurada");
  const model = process.env.CHAT_MODEL ?? "gpt-4o-mini";

  const expenseCats = context.categories.filter((c) => c.type === "EXPENSE").map((c) => c.name);
  const incomeCats = context.categories.filter((c) => c.type === "INCOME").map((c) => c.name);

  const system = `Sos el asistente financiero de "control.io", una app de finanzas personales argentina.
Hoy es ${context.today}. La moneda por defecto es ARS (pesos argentinos).

El usuario te escribe (o te manda audios) con los gastos e ingresos del día. Tu trabajo es:
1) Detectar la intención del mensaje.
2) Si registra movimientos, extraer cada gasto/ingreso por separado.
3) Si pregunta algo sobre sus finanzas, responder con los datos que te paso.

CUENTAS del usuario: ${context.accounts.map((a) => `"${a.name}" (${a.type}, saldo ${fmt(a.balance)} ${a.currency})`).join("; ") || "ninguna"}
CATEGORÍAS de gasto: ${expenseCats.join(", ") || "ninguna"}
CATEGORÍAS de ingreso: ${incomeCats.join(", ") || "ninguna"}
RESUMEN del mes actual: ingresos ${fmt(context.summary.totalIncome)}, gastos ${fmt(context.summary.totalExpense)}, balance ${fmt(context.summary.balance)} ARS.

Reglas para montos en jerga argentina:
- "5 lucas", "5 luca", "5k" = 5000. "un palo" = 1.000.000. "500 mangos" = 500.
- Si no se aclara la moneda, asumí ARS. Si dicen "dólares"/"usd"/"verdes", currency = "USD".

Respondé SIEMPRE en JSON válido con esta forma exacta:
{
  "intent": "register" | "query" | "chat",
  "items": [
    { "type": "EXPENSE"|"INCOME", "amount": number, "currency": "ARS"|"USD", "description": string, "category": string|null, "account": string|null }
  ],
  "answer": string
}

- "register": cuando el usuario informa uno o más gastos/ingresos. Llená "items". Elegí "category" SOLO de las listas dadas (la que mejor encaje); si ninguna encaja, usá null. Elegí "account" SOLO de las cuentas dadas si la menciona, sino null. "answer" debe ser una confirmación breve y amable.
- "query": cuando pregunta por saldos, cuánto gastó, resumen, etc. Dejá "items" vacío y respondé en "answer" con los datos de arriba, en tono breve y claro.
- "chat": saludos o cosas fuera de tema. "items" vacío, "answer" cordial recordando que podés registrar gastos/ingresos.
No inventes movimientos que el usuario no mencionó.`;

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

  const [accounts, categories, summary] = await Promise.all([
    getAccounts(userId),
    getCategories(userId),
    getMonthSummary(userId),
  ]);

  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const result = await interpret(clean, {
    accounts: accounts.map((a) => ({ name: a.name, type: a.type, balance: a.balance, currency: a.currency })),
    categories: categories.map((c) => ({ name: c.name, type: c.type })),
    summary,
    today,
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
      ? categories.find((c) => c.type === item.type && norm(c.name) === norm(item.category!)) ??
        categories.find((c) => c.type === item.type && norm(c.name).includes(norm(item.category!)))
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
    lines.push(`${emoji} ${signo}${cur}${fmt(item.amount)} — ${item.description || (item.type === "EXPENSE" ? "Gasto" : "Ingreso")}${catTxt}${accTxt}`);
  }

  if (created === 0) {
    return "No pude identificar un monto válido. Probá algo como: \"gasté 5 lucas en el súper\" 🙂";
  }

  const header = created === 1 ? "✅ Registrado:" : `✅ Registré ${created} movimientos:`;
  return `${header}\n\n${lines.join("\n")}`;
}
