"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

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

      const safeCatId = (row.categoryId && validCatIds.has(row.categoryId)) ? row.categoryId : null;
      const safeAccId = (row.accountId && validAccIds.has(row.accountId)) ? row.accountId : null;

      // Crear + actualizar saldo en una sola tx para evitar inconsistencias
      // si falla la segunda operación.
      await prisma.$transaction(async (db) => {
        await db.transaction.create({
          data: {
            userId: user.id,
            type: row.type,
            amount,
            currency: "ARS",
            description: encrypt(row.description?.slice(0, 255) || null),
            date,
            categoryId: safeCatId,
            accountId: safeAccId,
            notes: encrypt(row.notes || "Importado desde CSV"),
          },
        });

        if (safeAccId) {
          const delta = row.type === "INCOME" ? amount : -amount;
          await db.account.update({
            where: { id: safeAccId, userId: user.id },
            data: { balance: { increment: delta } },
          });
        }
      });

      imported++;
    } catch {
      errors++;
    }
  }

  revalidatePath("/movimientos");
  revalidatePath("/dashboard");

  return { ok: true, imported, errors, total: rows.length };
}
