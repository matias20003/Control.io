import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { encrypt, isEncrypted } from "@/lib/crypto";

const BATCH = 100;

async function encryptTextField(
  table: string,
  findMany: () => Promise<{ id: string; [key: string]: any }[]>,
  fields: string[],
  update: (id: string, data: Record<string, string | null>) => Promise<void>
): Promise<number> {
  let count = 0;
  const rows = await findMany();
  for (const row of rows) {
    const patch: Record<string, string | null> = {};
    for (const field of fields) {
      const val = row[field];
      if (val && !isEncrypted(val)) patch[field] = encrypt(val);
    }
    if (Object.keys(patch).length) { await update(row.id, patch); count++; }
  }
  return count;
}

export async function POST() {
  try {
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
      return Response.json({ error: "ENCRYPTION_KEY no configurada en Vercel." }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const results: Record<string, number> = {};

    // transactions — description, notes
    results.transactions = await encryptTextField(
      "transactions",
      () => prisma.transaction.findMany({ select: { id: true, description: true, notes: true } }),
      ["description", "notes"],
      (id, data) => prisma.transaction.update({ where: { id }, data }).then(() => {})
    );

    // accounts — name
    results.accounts = await encryptTextField(
      "accounts",
      () => prisma.account.findMany({ select: { id: true, name: true } }),
      ["name"],
      (id, data) => prisma.account.update({ where: { id }, data }).then(() => {})
    );

    // goals — name
    results.goals = await encryptTextField(
      "goals",
      () => prisma.goal.findMany({ select: { id: true, name: true } }),
      ["name"],
      (id, data) => prisma.goal.update({ where: { id }, data }).then(() => {})
    );

    // debts — personName, description
    results.debts = await encryptTextField(
      "debts",
      () => prisma.debt.findMany({ select: { id: true, personName: true, description: true } }),
      ["personName", "description"],
      (id, data) => prisma.debt.update({ where: { id }, data }).then(() => {})
    );

    // investments — name, notes
    results.investments = await encryptTextField(
      "investments",
      () => prisma.investment.findMany({ select: { id: true, name: true, notes: true } }),
      ["name", "notes"],
      (id, data) => prisma.investment.update({ where: { id }, data }).then(() => {})
    );

    // recurring_transactions — description
    results.recurring = await encryptTextField(
      "recurring_transactions",
      () => prisma.recurringTransaction.findMany({ select: { id: true, description: true } }),
      ["description"],
      (id, data) => prisma.recurringTransaction.update({ where: { id }, data }).then(() => {})
    );

    const total = Object.values(results).reduce((s, n) => s + n, 0);
    const detail = Object.entries(results)
      .filter(([, n]) => n > 0)
      .map(([t, n]) => `${t}: ${n}`)
      .join(", ");

    return Response.json({
      ok: true,
      total,
      detail,
      message: total > 0
        ? `${total} registros encriptados (${detail}).`
        : "Todo ya estaba encriptado.",
    });

  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Error interno" }, { status: 500 });
  }
}
