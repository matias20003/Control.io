import { NextRequest } from "next/server";

// Diagnóstico/utilidad read-mostly (auth por CRON_SECRET). NO expone la API key.
//  GET  → lista dominios de Resend + estado + los registros DNS EXACTOS que espera
//         para el dominio remitente (incluida la clave DKIM), para copiarlos a Hostinger.
//  POST → dispara la re-verificación del dominio remitente en Resend
//         (usar después de cargar los registros en Hostinger).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function cfg() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "control.io <noreply@controlio.site>";
  const senderDomain = from.match(/@([^>\s]+)/)?.[1];
  return { key, from, senderDomain, H: { Authorization: `Bearer ${key}` } };
}

async function findTarget(H: Record<string, string>, senderDomain?: string) {
  const listRes = await fetch("https://api.resend.com/domains", { headers: H, cache: "no-store" });
  const listJson = await listRes.json();
  if (!listRes.ok) return { error: listJson?.message ?? `status ${listRes.status}`, list: [], target: null };
  const list: { id: string; name: string; status: string; region?: string }[] = listJson?.data ?? [];
  return { list, target: list.find((d) => d.name === senderDomain) ?? null };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { key, from, senderDomain, H } = cfg();
  if (!key) return Response.json({ error: "no RESEND_API_KEY" }, { status: 500 });

  try {
    const { error, list, target } = await findTarget(H, senderDomain);
    if (error) return Response.json({ error }, { status: 502 });
    let detail: unknown = null;
    if (target) {
      const detRes = await fetch(`https://api.resend.com/domains/${target.id}`, { headers: H, cache: "no-store" });
      detail = await detRes.json();
    }
    return Response.json({
      ok: true,
      from,
      senderDomain,
      domains: list.map((d) => ({ id: d.id, name: d.name, status: d.status, region: d.region })),
      verified: list.filter((d) => d.status === "verified").map((d) => d.name),
      detail,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { key, senderDomain, H } = cfg();
  if (!key) return Response.json({ error: "no RESEND_API_KEY" }, { status: 500 });

  try {
    const { error, target } = await findTarget(H, senderDomain);
    if (error) return Response.json({ error }, { status: 502 });
    if (!target) return Response.json({ error: `${senderDomain} no está en la cuenta Resend` }, { status: 404 });
    const verRes = await fetch(`https://api.resend.com/domains/${target.id}/verify`, { method: "POST", headers: H });
    const verJson = await verRes.json();
    return Response.json({ ok: verRes.ok, triggered: true, result: verJson }, { status: verRes.ok ? 200 : 502 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
