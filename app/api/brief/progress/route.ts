import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recordBriefItemOpened } from "@/lib/db/brief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  editionId: z.string().min(1).max(200),
  url: z.url().refine((value) => value.startsWith("https://")),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const reviewedCount = await recordBriefItemOpened(
      user.id,
      parsed.data.editionId,
      parsed.data.url
    );
    return Response.json({ ok: true, reviewedCount });
  } catch {
    return Response.json({ error: "Edition not found" }, { status: 404 });
  }
}
