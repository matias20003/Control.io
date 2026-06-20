import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, saveGoogleConnection } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("g_oauth_state")?.value;
  const back = (p: string) => NextResponse.redirect(new URL(`/configuracion?google=${p}`, req.url));

  if (url.searchParams.get("error")) return back("denied");
  if (!code || !state || !cookieState || state !== cookieState) return back("error");

  try {
    const { refreshToken, email } = await exchangeCode(code);
    // Google a veces no devuelve refresh_token si el usuario ya había consentido;
    // prompt=consent lo fuerza, pero por las dudas avisamos.
    if (!refreshToken) return back("norefresh");
    await saveGoogleConnection(user.id, refreshToken, email);
    return back("ok");
  } catch (e) {
    console.error("[google callback]", e);
    return back("error");
  }
}
