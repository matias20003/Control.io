import { NextRequest } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";

// Diagnóstico de configuración de IA (solo booleanos + prueba en vivo, NUNCA
// expone las claves). Protegido con CRON_SECRET. Temporal para verificar env.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !bearerMatches(req.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = {
    gemini_key: !!process.env.GEMINI_API_KEY,
    gemini_key_prefix: (process.env.GEMINI_API_KEY ?? "").slice(0, 4),
    gemini_model: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
    fallback_openai_key: !!process.env.OPENAI_API_KEY,
    fallback_base_url: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    fallback_chat_model: process.env.CHAT_MODEL ?? "gpt-4o-mini",
    openrouter_key: !!process.env.OPENROUTER_API_KEY,
    admin_email_set: !!process.env.ADMIN_EMAIL,
  };

  // Prueba en vivo a Gemini (?test=1)
  let geminiTest: string = "no-corrida (agregá ?test=1)";
  if (cfg.gemini_key && req.nextUrl.searchParams.get("test") === "1") {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${cfg.gemini_model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: "respondé: ok" }] }] }) }
      );
      const body = await r.text().catch(() => "");
      geminiTest = r.ok ? `OK (HTTP ${r.status})` : `HTTP ${r.status} — ${body.slice(0, 120)}`;
    } catch (e) {
      geminiTest = `error: ${e instanceof Error ? e.message : "?"}`;
    }
  }

  return Response.json({ cfg, geminiTest });
}
