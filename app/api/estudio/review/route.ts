import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markReviewDone } from "@/lib/db/study";

// Solo dueño: marcar un repaso como hecho.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const { reviewId } = await req.json().catch(() => ({}));
  if (!reviewId) return Response.json({ error: "falta reviewId" }, { status: 400 });
  await markReviewDone(user.id, reviewId);
  return Response.json({ ok: true });
}
