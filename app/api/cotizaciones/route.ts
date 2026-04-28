import { NextRequest, NextResponse } from "next/server";
import { refreshCotizaciones, getCotizaciones } from "@/lib/cotizaciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cotizaciones?refresh=true — returns current rates (from cache or fresh fetch) */
export async function GET(req: NextRequest) {
  try {
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";
    const data = forceRefresh ? await refreshCotizaciones() : await getCotizaciones();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
