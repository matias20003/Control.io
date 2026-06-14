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

  // Normalizamos (fecha, monto, IDs válidos) y descartamos inválidas.
  const normalized = rows
    .map((row) => {
      const date = parseDate(row.date);
      const amount = Math.abs(row.amount);
      const safeCatId = (row.categoryId && validCatIds.has(row.categoryId)) ? row.categoryId : null;
      const safeAccId = (row.accountId && validAccIds.has(row.accountId)) ? row.accountId : null;
      return { date, amount, type: row.type, description: row.description, categoryId: safeCatId, accountId: safeAccId };
    })
    .filter((n) => !isNaN(n.date.getTime()) && n.amount > 0);

  // ── Anti-duplicados ──
  // Clave por (cuenta | fecha | monto | tipo). Contamos cuántos ya existen y
  // salteamos esa cantidad: re-subir el resumen completo solo agrega lo NUEVO.
  const keyOf = (accId: string | null, date: Date, amount: number, type: string) =>
    `${accId ?? "-"}|${date.toISOString().slice(0, 10)}|${Math.round(amount * 100)}|${type}`;

  const counts = new Map<string, number>();
  if (normalized.length) {
    const times = normalized.map((n) => n.date.getTime());
    const min = new Date(Math.min(...times) - 86_400_000);
    const max = new Date(Math.max(...times) + 86_400_000);
    const existing = await prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: min, lte: max } },
      select: { date: true, amount: true, type: true, accountId: true },
    });
    for (const e of existing) {
      const k = keyOf(e.accountId, e.date, Number(e.amount), e.type);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const n of normalized) {
    const k = keyOf(n.accountId, n.date, n.amount, n.type);
    const remaining = counts.get(k) ?? 0;
    if (remaining > 0) { counts.set(k, remaining - 1); skipped++; continue; } // ya existía → no duplicamos

    try {
      await prisma.$transaction(async (db) => {
        await db.transaction.create({
          data: {
            userId: user.id,
            type: n.type,
            amount: n.amount,
            currency: "ARS",
            description: encrypt(n.description?.slice(0, 255) || null),
            date: n.date,
            categoryId: n.categoryId,
            accountId: n.accountId,
            notes: encrypt("Importado desde CSV"),
          },
        });
        if (n.accountId) {
          const delta = n.type === "INCOME" ? n.amount : -n.amount;
          await db.account.update({
            where: { id: n.accountId, userId: user.id },
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
  revalidatePath("/cuentas");

  return { ok: true, imported, skipped, errors, total: rows.length };
}
