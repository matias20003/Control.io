import "server-only";
import type { ChatTurn } from "@/lib/whatsapp/memory";
import { recordAiProviderUsage } from "@/lib/ai/provider-usage";

// Capa de chat del bot con DOS proveedores:
//  1) Gemini nativo (GRATIS) → principal
//  2) OpenAI-compatible (OpenRouter/OpenAI, de OPENAI_* ) → respaldo
// Ambos devuelven el CONTENIDO (string JSON) que el bot parsea igual.

export type ChatJsonInput = {
  system: string;
  history: ChatTurn[];
  userText: string;
  imageDataUrl?: string; // data:...;base64,...  (foto de ticket)
};

/** Error con status para distinguir 429 (cupo) de otros. */
export class LlmError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function dataUrlToInline(url?: string): { inline_data: { mime_type: string; data: string } } | null {
  if (!url) return null;
  const m = url.match(/^data:([^;]+);base64,(.*)$/);
  return m ? { inline_data: { mime_type: m[1], data: m[2] } } : null;
}

/** ¿Hay Gemini configurado como principal? */
export function geminiEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/** Gemini nativo (gratis). Devuelve el string JSON del modelo. Lanza LlmError si falla. */
export async function geminiChatJson({ system, history, userText, imageDataUrl }: ChatJsonInput): Promise<string> {
  const key = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
  const inline = dataUrlToInline(imageDataUrl);
  const contents = [
    ...history.map((h) => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
    { role: "user", parts: [{ text: userText || "." }, ...(inline ? [inline] : [])] },
  ];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    await recordAiProviderUsage({ provider: "gemini", model, success: false, statusCode: res.status }).catch(() => {});
    throw new LlmError(res.status, `gemini ${res.status}: ${b.slice(0, 180)}`);
  }
  const j = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };
  await recordAiProviderUsage({
    provider: "gemini", model, success: true, statusCode: 200,
    promptTokens: j.usageMetadata?.promptTokenCount,
    completionTokens: j.usageMetadata?.candidatesTokenCount,
    totalTokens: j.usageMetadata?.totalTokenCount,
  }).catch(() => {});
  return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("") || "{}";
}

/** OpenAI-compatible (OpenRouter/OpenAI). Respaldo. Devuelve el string JSON del modelo. */
export async function openaiChatJson({ system, history, userText, imageDataUrl }: ChatJsonInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new LlmError(500, "OPENAI_API_KEY no configurada (respaldo)");
  const model = process.env.CHAT_MODEL ?? "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const userContent: unknown = imageDataUrl
    ? [{ type: "text", text: userText || "." }, { type: "image_url", image_url: { url: imageDataUrl } }]
    : userText;
  const res = await fetch(`${baseUrl}/chat/completions`, {
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
    const b = await res.text().catch(() => "");
    if (baseUrl.includes("openrouter")) {
      await recordAiProviderUsage({ provider: "openrouter", model, success: false, statusCode: res.status }).catch(() => {});
    }
    throw new LlmError(res.status, `LLM falló (${res.status}): ${b}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
  };
  if (baseUrl.includes("openrouter")) {
    await recordAiProviderUsage({
      provider: "openrouter", model, success: true, statusCode: 200,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
      costUsd: data.usage?.cost,
    }).catch(() => {});
  }
  return data.choices?.[0]?.message?.content ?? "{}";
}
