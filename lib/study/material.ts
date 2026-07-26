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
  if (!text.trim() && imageDataUrls.length === 0) return "";

  const system =
    `Resumí el CONTENIDO para estudiar: puntos clave, definiciones, fórmulas y ` +
    `procedimientos que APAREZCAN. Markdown con viñetas y **negritas** en lo importante. ` +
    `REGLA: usá SOLO el contenido, NO inventes ni agregues datos externos. Conciso pero ` +
    `completo (para "pegar una leída"). MATEMÁTICA: escribí toda fórmula/símbolo en LaTeX entre ` +
    `signos $ — inline $x^2$ y en bloque $$\\int_a^b f(x)\\,dx$$ (comandos \\int, \\sum, \\frac, ` +
    `\\lim, \\Delta, _{}, ^{}). ${topicHint ? `Tema: ${topicHint}.` : ""}`;

  const { studyGenerate } = await import("@/lib/ai/generate");
  return await studyGenerate({
    system,
    userText: text.trim() ? "CONTENIDO (texto):\n" + text.slice(0, 30000) : "Resumí el CONTENIDO de las imágenes.",
    imageDataUrls: imageDataUrls.slice(0, 8),
  });
}
