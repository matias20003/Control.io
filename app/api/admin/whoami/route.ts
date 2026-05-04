import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return Response.json({
    email: user?.email ?? null,
    admin_email_env: process.env.ADMIN_EMAIL ?? "(no configurado)",
    match: user?.email === process.env.ADMIN_EMAIL,
  });
}
