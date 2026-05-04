/**
 * One-time migration: encrypts all existing plaintext description/notes
 * in the transactions table. Safe to run multiple times (skips already-encrypted rows).
 *
 * Protected: only the ADMIN_EMAIL user can call this.
 * POST /api/admin/migrate-encrypt
 */

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { encrypt, isEncrypted } from "@/lib/crypto";

const BATCH_SIZE = 100;

export async function POST() {
  // Auth check — only admin can run this
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  let processed = 0;
  let encrypted = 0;
  let cursor: string | undefined;

  // Process in batches to avoid memory issues with large datasets
  while (true) {
    const batch = await prisma.transaction.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, description: true, notes: true },
      orderBy: { id: "asc" },
    });

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;
    processed += batch.length;

    for (const tx of batch) {
      const needsDesc  = tx.description && !isEncrypted(tx.description);
      const needsNotes = tx.notes       && !isEncrypted(tx.notes);
      if (!needsDesc && !needsNotes) continue;

      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          ...(needsDesc  ? { description: encrypt(tx.description) } : {}),
          ...(needsNotes ? { notes:       encrypt(tx.notes)       } : {}),
        },
      });
      encrypted++;
    }
  }

  return Response.json({
    ok: true,
    processed,
    encrypted,
    message: `${encrypted} de ${processed} registros encriptados.`,
  });
}
