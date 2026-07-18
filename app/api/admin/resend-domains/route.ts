import { NextRequest } from "next/server";

// Diagnóstico read-only (auth por CRON_SECRET): lista los dominios de la cuenta
// Resend y su estado de verificación. NO expone la API key. Sirve para decidir
// si hay algún dominio ya verificado desde el cual poder enviar la reactivación.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return Response.json({ error: "no RESEND_API_KEY" }, { status: 500 });

  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) return Response.json({ error: json?.message ?? `status ${res.status}` }, { status: 502 });
    const list: { name: string; status: string; region?: string }[] = json?.data ?? [];
    return Response.json({
      ok: true,
      from: process.env.RESEND_FROM ?? "control.io <noreply@controlio.site>",
      domains: list.map((d) => ({ name: d.name, status: d.status, region: d.region })),
      verified: list.filter((d) => d.status === "verified").map((d) => d.name),
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
