import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStudyOwner } from "@/lib/study/ingest";
import { runStudyAgent, type ChatMsg } from "@/lib/study/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isStudyOwner(user.id))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { messages?: ChatMsg[] };
  const history = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  if (history.length === 0) return Response.json({ error: "Sin mensajes" }, { status: 400 });

  const result = await runStudyAgent(user.id, history);
  return Response.json(result);
}
