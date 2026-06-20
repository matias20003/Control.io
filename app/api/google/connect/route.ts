import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/feature-flags";
import { getAuthUrl, googleConfigured } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { isTester: true } });
  if (!hasFeature("google", { isTester: profile?.isTester ?? false }) || !googleConfigured()) {
    return NextResponse.redirect(new URL("/configuracion?google=unavailable", req.url));
  }

  // state anti-CSRF (se valida en el callback contra la cookie).
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(getAuthUrl(state));
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
  });
  return res;
}
