import "server-only";

// Divide un material (apunte/PDF/clase) en varios BLOQUES de estudio manejables,
// siguiendo la metodología: solo contenido del material, con resumen + definiciones/
// fórmulas + prerequisitos + dificultad + importancia + tiempo estimado por bloque.

export type ProposedBlock = {
  topic: string;
  unit: string | null;
  summary: string; // markdown: resumen + definiciones + fórmulas + procedimientos
  prerequisites: string | null;
  difficulty: number; // 1..4
  importance: number; // 1..4
  estMinutes: number; // tiempo estimado del primer estudio
  external: boolean; // true si el bloque agrega explicación externa (no del material)
};

export type AnalyzeResult = { unit: string; blocks: ProposedBlock[] };

const SYSTEM =
  `Sos un organizador de estudio por repetición espaciada para un estudiante de ingeniería (UTN). ` +
  `Te paso el CONTENIDO de un apunte/clase/PDF/guía. Tu tarea es dividirlo en BLOQUES de estudio ` +
  `LÓGICOS y MANEJABLES (cada uno estudiable en ~20 a 40 minutos). Reglas:\n` +
  `- Usá SOLO el contenido del material. No inventes temas que no estén.\n` +
  `- Si agregás una aclaración externa para que se entienda, marcá ese bloque con "external": true.\n` +
  `- Para cada bloque: un resumen claro en markdown (con **negritas**, viñetas), extrayendo ` +
  `definiciones, fórmulas y procedimientos si los hay.\n` +
  `- Estimá dificultad (1 fácil … 4 muy difícil), importancia probable para el examen (1 baja … 4 muy alta) ` +
  `y tiempo del primer estudio en minutos (entre 15 y 45).\n` +
  `- Indicá prerequisitos (temas previos necesarios) o null.\n` +
  `- Detectá la unidad/tema general.\n` +
  `Respondé SOLO JSON con esta forma exacta:\n` +
  `{"unit":"nombre de la unidad","blocks":[{"topic":"...","summary":"...markdown...",` +
  `"prerequisites":"... o null","difficulty":2,"importance":3,"estMinutes":30,"external":false}]}`;

function coerce(raw: unknown, hintUnit?: string): AnalyzeResult {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const unit = (typeof obj.unit === "string" && obj.unit.trim()) || hintUnit || "General";
  const rawBlocks = Array.isArray(obj.blocks) ? obj.blocks : [];
  const blocks: ProposedBlock[] = rawBlocks
    .map((b): ProposedBlock | null => {
      const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
      const topic = typeof o.topic === "string" ? o.topic.trim().slice(0, 160) : "";
      if (!topic) return null;
      const clamp = (n: unknown, lo: number, hi: number, def: number) => {
        const v = typeof n === "number" ? n : parseInt(String(n), 10);
        return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : def;
      };
      return {
        topic,
        unit: typeof o.unit === "string" && o.unit.trim() ? o.unit.trim().slice(0, 80) : unit.slice(0, 80),
        summary: typeof o.summary === "string" ? o.summary.slice(0, 6000) : "",
        prerequisites: typeof o.prerequisites === "string" && o.prerequisites.trim() && o.prerequisites.trim().toLowerCase() !== "null" ? o.prerequisites.trim().slice(0, 200) : null,
        difficulty: clamp(o.difficulty, 1, 4, 2),
        importance: clamp(o.importance, 1, 4, 2),
        estMinutes: clamp(o.estMinutes, 15, 45, 30),
        external: o.external === true,
      };
    })
    .filter((b): b is ProposedBlock => b !== null)
    .slice(0, 20); // tope de bloques por carga
  return { unit, blocks };
}

// ─── Google Gemini (nivel GRATUITO con visión). Preferido si hay GEMINI_API_KEY. ───
function geminiModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
}
function dataUrlToInline(url: string): { inline_data: { mime_type: string; data: string } } | null {
  const m = url.match(/^data:([^;]+);base64,(.*)$/);
  return m ? { inline_data: { mime_type: m[1], data: m[2] } } : null;
}
async function geminiJson(parts: unknown[]): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY!;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } }),
  });
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("La IA (Gemini) está sin cupo por ahora (429). Probá en unos minutos.");
    if (res.status === 400 && /API key/i.test(b)) throw new Error("La clave de Gemini no es válida. Revisá GEMINI_API_KEY.");
    console.error("[analyze] gemini error", res.status, b.slice(0, 300));
    throw new Error(`IA (Gemini) falló (${res.status}). ${b.slice(0, 120)}`);
  }
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const txt = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("") || "{}";
  return JSON.parse(txt);
}

/** Divide texto en bloques (Gemini gratis si hay key; si no, OpenRouter). */
export async function analyzeTextToBlocks(rawText: string, hintSubject?: string): Promise<AnalyzeResult> {
  if (process.env.GEMINI_API_KEY) {
    const text = rawText.slice(0, 45000);
    return coerce(await geminiJson([{ text: SYSTEM + (hintSubject ? `\nLa materia es: ${hintSubject}.` : "") + "\n\nCONTENIDO:\n" + text }]));
  }
  return analyzeTextToBlocksOpenRouter(rawText, hintSubject);
}

async function analyzeTextToBlocksOpenRouter(rawText: string, hintSubject?: string): Promise<AnalyzeResult> {
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL?.split(",")[0]?.trim() || "openai/gpt-4o-mini";
  const text = rawText.slice(0, 45000);
  if (!key) return { unit: "General", blocks: [] };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM + (hintSubject ? `\nLa materia es: ${hintSubject}.` : "") },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error("llm");
  const j = await res.json();
  return coerce(JSON.parse(j.choices?.[0]?.message?.content ?? "{}"));
}

/** Divide imágenes en bloques. Gemini gratis si hay key; si no, visión OpenAI. */
export async function analyzeImagesToBlocks(imageDataUrls: string[], hintSubject?: string): Promise<AnalyzeResult> {
  if (!imageDataUrls.length) return { unit: "General", blocks: [] };

  // Gemini (gratuito) preferido si está configurado.
  if (process.env.GEMINI_API_KEY) {
    const parts: unknown[] = [
      { text: SYSTEM + `\nLas imágenes son apuntes (posiblemente MANUSCRITOS): transcribí la letra a mano y los diagramas.` + (hintSubject ? ` La materia es: ${hintSubject}.` : "") },
      ...imageDataUrls.map(dataUrlToInline).filter((x): x is NonNullable<typeof x> => x !== null),
    ];
    return coerce(await geminiJson(parts));
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.CHAT_MODEL ?? "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  if (!apiKey || !imageDataUrls.length) return { unit: "General", blocks: [] };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: SYSTEM + `\nLas imágenes son apuntes (posiblemente MANUSCRITOS): transcribí la letra a mano y los diagramas.` + (hintSubject ? ` La materia es: ${hintSubject}.` : "") },
            ...imageDataUrls.map((url) => ({ type: "image_url", image_url: { url } })),
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("La IA está sin cupo o saturada ahora (429). Probá en unos minutos.");
    if (res.status === 401) throw new Error("La clave de IA no es válida (401). Avisá para revisar la config.");
    console.error("[analyze] vision error", res.status, body.slice(0, 300));
    throw new Error(`IA de visión falló (${res.status}). ${body.slice(0, 120)}`);
  }
  const j = await res.json();
  return coerce(JSON.parse(j.choices?.[0]?.message?.content ?? "{}"));
}
