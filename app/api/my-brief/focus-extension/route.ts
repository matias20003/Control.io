import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MY_BRIEF_EMAIL = "yorismatias372@gmail.com";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autenticado." }, { status: 401 });
  }

  if (user.email?.toLowerCase() !== MY_BRIEF_EMAIL) {
    return Response.json({ error: "No disponible." }, { status: 404 });
  }

  const archive = await readFile(
    path.join(process.cwd(), "browser-extension", "controlio-focus.zip")
  );

  return new Response(new Uint8Array(archive), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="controlio-focus.zip"',
      "Content-Length": String(archive.byteLength),
      "Content-Type": "application/zip",
    },
  });
}
