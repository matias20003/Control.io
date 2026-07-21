import "server-only";

export type Priority = "alta" | "media" | "baja";
export type EmailClassification = { category: string; priority: Priority; reason: string };

export const EMAIL_CATEGORIES = [
  "Urgente",
  "Cliente/Trabajo",
  "Factura/Pago",
  "Seguridad",
  "Personal",
  "Newsletter",
  "Promoción/Spam",
  "Otro",
];

const fallback = (n: number): EmailClassification[] =>
  Array.from({ length: n }, () => ({ category: "Otro", priority: "baja" as const, reason: "" }));

/**
 * Clasifica una tanda de correos (categoría + prioridad) en UNA sola llamada al
 * LLM (OpenRouter). Barato y rápido. Si no hay key o falla, devuelve "Otro/baja".
 */
export async function classifyEmails(
  emails: { from: string; subject: string }[]
): Promise<EmailClassification[]> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !emails.length) return fallback(emails.length);

  const model =
    process.env.OPENROUTER_MODEL?.split(",")[0]?.trim() || "openai/gpt-4o-mini";
  const list = emails
    .map((e, i) => `${i}. De: ${e.from} — Asunto: ${e.subject}`)
    .join("\n");

  const system =
    `Clasificás correos de una bandeja de entrada (dueño de un negocio en Argentina). ` +
    `Para CADA correo devolvé categoría y prioridad.\n` +
    `Categorías: ${EMAIL_CATEGORIES.join(", ")}.\n` +
    `Prioridad: "alta" (requiere acción, es urgente, es un cliente, un pago/factura o una alerta de seguridad real), ` +
    `"media" (importante pero no urgente), "baja" (newsletter, promo, spam, notificaciones automáticas).\n` +
    `Respondé SOLO JSON válido: {"items":[{"i":0,"category":"...","priority":"alta|media|baja","reason":"3-6 palabras"}]}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: list },
        ],
      }),
    });
    if (!res.ok) return fallback(emails.length);
    const j = await res.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    const byI = new Map<number, { category?: string; priority?: string; reason?: string }>(
      (parsed.items ?? []).map((it: { i: number }) => [it.i, it])
    );
    return emails.map((_, i) => {
      const it = byI.get(i) ?? {};
      const priority: Priority = (["alta", "media", "baja"] as const).includes(it.priority as Priority)
        ? (it.priority as Priority)
        : "baja";
      return {
        category: it.category && EMAIL_CATEGORIES.includes(it.category) ? it.category : "Otro",
        priority,
        reason: it.reason ?? "",
      };
    });
  } catch {
    return fallback(emails.length);
  }
}
