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

/** Divide texto en bloques (OpenRouter). */
export async function analyzeTextToBlocks(rawText: string, hintSubject?: string): Promise<AnalyzeResult> {
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

/** Divide imágenes (apuntes, incluso manuscritos) en bloques (visión OpenAI). */
export async function analyzeImagesToBlocks(imageDataUrls: string[], hintSubject?: string): Promise<AnalyzeResult> {
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
  if (!res.ok) throw new Error("vision");
  const j = await res.json();
  return coerce(JSON.parse(j.choices?.[0]?.message?.content ?? "{}"));
}
