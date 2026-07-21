import { NextRequest, NextResponse } from "next/server";
import { refreshCotizaciones, getCotizaciones } from "@/lib/cotizaciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rate limit en memoria por IP. Sirve para frenar abusos básicos del endpoint
// público; no es resistente a múltiples instancias serverless ni a IPs
// distribuidas. Para esa amenaza usar un store externo (Upstash, etc.).
const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimitOk(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Cleanup oportunista para que el Map no crezca sin límite.
  if (hits.size > 1000) {
    for (const [k, ts] of hits) {
      const fresh = ts.filter((t) => now - t < windowMs);
      if (fresh.length === 0) hits.delete(k);
      else hits.set(k, fresh);
    }
  }
  return true;
}

/** GET /api/cotizaciones?refresh=true — returns current rates (from cache or fresh fetch) */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";

  // Refresh es caro (toca un API externo): 2 por minuto por IP.
  // Read de caché: 60 por minuto.
  const ok = forceRefresh
    ? rateLimitOk(`refresh:${ip}`, 2, 60_000)
    : rateLimitOk(`read:${ip}`, 60, 60_000);

  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Rate limit excedido. Probá de nuevo en un minuto." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  try {
    const data = forceRefresh ? await refreshCotizaciones() : await getCotizaciones();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[cotizaciones] error:", err);
    return NextResponse.json({ ok: false, error: "No se pudieron obtener las cotizaciones" }, { status: 500 });
  }
}
