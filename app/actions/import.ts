"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ImportRow = {
  date: string;         // ISO or "dd/mm/yyyy"
  description: string;
  amount: number;       // always positive
  type: "INCOME" | "EXPENSE";
  categoryId?: string;
  accountId?: string;
  notes?: string;
};

function parseDate(raw: string): Date {
  // Try ISO first
  const iso = new Date(raw);
  if (!isNaN(iso.getTime())) return iso;

  // Try dd/mm/yyyy
  const [d, m, y] = raw.split(/[\/\-]/);
  const attempt = new Date(`${y}-${m?.padStart(2, "0")}-${d?.padStart(2, "0")}`);
  if (!isNaN(attempt.getTime())) return attempt;

  return new Date(); // fallback to today
}

export async function importTransactionsAction(rows: ImportRow[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  if (!rows.length) return { error: "No hay filas para importar" };
  if (rows.length > 500) return { error: "Máximo 500 filas por importación" };

  // Pre-cargar IDs válidos del usuario para evitar IDOR en categoryId/accountId
  const [validCategories, validAccounts] = await Promise.all([
    prisma.category.findMany({ where: { userId: user.id }, select: { id: true } }),
    prisma.account.findMany({ where: { userId: user.id }, select: { id: true } }),
  ]);
  const validCatIds = new Set(validCategories.map(c => c.id));
  const validAccIds = new Set(validAccounts.map(a => a.id));

  let imported = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const date = parseDate(row.date);
      if (isNaN(date.getTime())) { errors++; continue; }

      const amount = Math.abs(row.amount);
      if (!amount || amount <= 0) { errors++; continue; }

      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: row.type,
          amount,
          currency: "ARS",
          description: row.description?.slice(0, 255) || null,
          date,
          categoryId: (row.categoryId && validCatIds.has(row.categoryId)) ? row.categoryId : null,
          accountId: (row.accountId && validAccIds.has(row.accountId)) ? row.accountId : null,
          notes: row.notes || "Importado desde CSV",
        },
      });

      // Update account balance
      if (row.accountId) {
        const delta = row.type === "INCOME" ? amount : -amount;
        await prisma.account.update({
          where: { id: row.accountId, userId: user.id },
          data: { balance: { increment: delta } },
        }).catch(() => {});
      }

      imported++;
    } catch {
      errors++;
    }
  }

  revalidatePath("/movimientos");
  revalidatePath("/dashboard");

  return { ok: true, imported, errors, total: rows.length };
}
