import "server-only";

/**
 * Resume material (texto y/o imágenes) en puntos de estudio, con Gemini (gratis),
 * USANDO SOLO el contenido dado (no inventa). Devuelve markdown para guardar como
 * el "resumen" del tema (de ahí salen luego las flashcards).
 */
export async function summarizeToStudyPoints(
  text: string,
  imageDataUrls: string[],
  topicHint?: string
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

  const parts: unknown[] = [];
  if (text.trim()) parts.push({ text: "CONTENIDO (texto):\n" + text.slice(0, 30000) });
  for (const url of imageDataUrls.slice(0, 8)) {
    const m = url.match(/^data:([^;]+);base64,(.*)$/);
    if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
  }
  if (!parts.length) return "";

  // Sin Gemini configurado: guardamos el texto crudo (mejor eso que nada).
  if (!key) return text.trim().slice(0, 6000);

  const system =
    `Resumí el CONTENIDO para estudiar: puntos clave, definiciones, fórmulas y ` +
    `procedimientos que APAREZCAN. Markdown con viñetas y **negritas** en lo importante. ` +
    `REGLA: usá SOLO el contenido, NO inventes ni agregues datos externos. Conciso pero ` +
    `completo (para "pegar una leída"). MATEMÁTICA: escribí toda fórmula/símbolo en LaTeX entre ` +
    `signos $ — inline $x^2$ y en bloque $$\\int_a^b f(x)\\,dx$$ (comandos \\int, \\sum, \\frac, ` +
    `\\lim, \\Delta, _{}, ^{}). ${topicHint ? `Tema: ${topicHint}.` : ""}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("La IA está sin cupo ahora (429). Probá en unos minutos.");
    throw new Error(`La IA falló (${res.status})`);
  }
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
}
