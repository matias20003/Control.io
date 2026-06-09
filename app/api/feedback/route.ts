import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createFeedback } from "@/lib/db/feedback";
import { getResend, FROM } from "@/lib/email/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  message: z.string().trim().min(3, "Contanos un poco más").max(2000),
  page: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  // Fuente de verdad: lo guardamos en la DB (no se pierde aunque el email falle).
  await createFeedback({
    userId: user.id,
    email: user.email ?? null,
    message: parsed.data.message,
    page: parsed.data.page ?? null,
  });

  // Aviso por email — best-effort, no rompe si Resend no está configurado.
  const to = process.env.FEEDBACK_TO ?? "control.io.oficial@gmail.com";
  if (process.env.RESEND_API_KEY) {
    try {
      await getResend().emails.send({
        from: FROM,
        to,
        replyTo: user.email ?? undefined,
        subject: `🗣️ Feedback de ${user.email ?? "un tester"}`,
        text: `De: ${user.email ?? user.id}\nPágina: ${parsed.data.page ?? "—"}\n\n${parsed.data.message}`,
      });
    } catch {
      // best-effort
    }
  }

  return Response.json({ ok: true });
}
