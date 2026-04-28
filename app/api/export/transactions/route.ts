import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";

export const runtime = "nodejs";

function esc(v: string | null | undefined): string {
  if (!v) return "";
  return v.includes(",") || v.includes('"') || v.includes("\n")
    ? `"${v.replace(/"/g, '""')}"`
    : v;
}

function toNum(v: unknown): number {
  if (!v) return 0;
  return typeof v === "number" ? v : parseFloat(String(v));
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const all = searchParams.get("all") === "true";

  const whereDate = all
    ? {}
    : { date: { gte: startOfMonth(new Date(year, month - 1)), lte: endOfMonth(new Date(year, month - 1)) } };

  const txs = await prisma.transaction.findMany({
    where: { userId: user.id, ...whereDate },
    include: {
      category: { select: { name: true } },
      account: { select: { name: true } },
      toAccount: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  const TYPE_LABELS: Record<string, string> = {
    INCOME: "Ingreso",
    EXPENSE: "Gasto",
    TRANSFER: "Transferencia",
    INVESTMENT: "Inversión",
    DEBT_PAYMENT: "Pago deuda",
  };

  const rows = [
    ["Fecha", "Tipo", "Descripción", "Monto", "Moneda", "Categoría", "Cuenta", "Cuenta destino", "Notas"].join(","),
    ...txs.map((tx) =>
      [
        new Date(tx.date).toLocaleDateString("es-AR"),
        TYPE_LABELS[tx.type] ?? tx.type,
        esc(tx.description),
        toNum(tx.amount).toFixed(2),
        tx.currency,
        esc(tx.category?.name),
        esc(tx.account?.name),
        esc(tx.toAccount?.name),
        esc(tx.notes),
      ].join(",")
    ),
  ].join("\n");

  const fileName = all
    ? "movimientos_completo.csv"
    : `movimientos_${year}-${String(month).padStart(2, "0")}.csv`;

  return new NextResponse(rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
