import "server-only";
import { notifyAdminThrottled, bumpDailyCounter } from "@/lib/alerts";
import { todayStringArg } from "@/lib/timezone";

// Generación de IA para ESTUDIO con Gemini (gratis) como principal y OpenRouter
// (OPENAI_* ) de respaldo cuando Gemini se queda sin cupo (429) o falla — así
// las flashcards, resúmenes y análisis nunca se cortan.

type StudyGenInput = {
  system: string;
  userText: string;
  imageDataUrls?: string[];
  json?: boolean; // pedir salida JSON
};

function dataUrlToInline(url: string): { inline_data: { mime_type: string; data: string } } | null {
  const m = url.match(/^data:([^;]+);base64,(.*)$/);
  return m ? { inline_data: { mime_type: m[1], data: m[2] } } : null;
}

async function geminiRaw({ system, userText, imageDataUrls, json }: StudyGenInput): Promise<string> {
  const key = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
  const parts: unknown[] = [{ text: userText }];
  for (const u of imageDataUrls ?? []) { const p = dataUrlToInline(u); if (p) parts.push(p); }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.2, ...(json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    const err = new Error(`gemini ${res.status}: ${b.slice(0, 160)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
}

async function openrouterRaw({ system, userText, imageDataUrls, json }: StudyGenInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("La IA está sin cupo y no hay respaldo configurado.");
  const model = process.env.CHAT_MODEL ?? "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const content: unknown = imageDataUrls?.length
    ? [{ type: "text", text: userText }, ...imageDataUrls.map((u) => ({ type: "image_url", image_url: { url: u } }))]
    : userText;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: system }, { role: "user", content }],
    }),
  });
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    throw new Error(`IA (respaldo) falló (${res.status}): ${b.slice(0, 120)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/** Gemini primero; si se satura/falla, OpenRouter. Avisa al admin al caer al respaldo. */
export async function studyGenerate(input: StudyGenInput): Promise<string> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiRaw(input);
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      const isQuota = status === 429;
      const n = await bumpDailyCounter(isQuota ? "gemini_quota" : "gemini_error", todayStringArg()).catch(() => 0);
      await notifyAdminThrottled(
        isQuota ? "alert_gemini_quota" : "alert_gemini_error",
        isQuota ? 60 : 30,
        isQuota ? "⚠️ Gemini llegó al límite gratis" : "⚠️ Gemini falló",
        `Estudio pasó a OpenRouter de respaldo.${isQuota ? " (cupo gratuito agotado)" : ""} Van ${n} veces hoy. Si sigue, cargá créditos.`
      ).catch(() => {});
      // Fallback
      return await openrouterRaw(input);
    }
  }
  return await openrouterRaw(input);
}
