import { NextRequest, NextResponse } from "next/server";
import { getTransferRateReference } from "@/lib/services/transfer-rates";

const SUPPORTED = new Set(["USD", "EUR", "BRL", "CLP", "UYU", "BTC"]);

export async function GET(request: NextRequest) {
  const currency = (request.nextUrl.searchParams.get("currency") ?? "").toUpperCase();
  if (!SUPPORTED.has(currency)) {
    return NextResponse.json({ ok: false, error: "Moneda no soportada" }, { status: 400 });
  }

  try {
    const data = await getTransferRateReference(currency);
    if (!data) {
      return NextResponse.json({ ok: false, error: "Cotización no disponible" }, { status: 503 });
    }
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo consultar DolarAPI" }, { status: 502 });
  }
}
