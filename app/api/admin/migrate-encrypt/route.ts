import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { encrypt, isEncrypted } from "@/lib/crypto";

const BATCH_SIZE = 100;

export async function POST() {
  try {
    // Verify ENCRYPTION_KEY is set
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
      return Response.json(
        { error: "ENCRYPTION_KEY no configurada en Vercel. Agregala en Settings → Environment Variables y redeploy." },
        { status: 500 }
      );
    }

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    let processed = 0;
    let encrypted = 0;
    let cursor: string | undefined;

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

  } catch (e: any) {
    return Response.json(
      { error: e?.message ?? "Error interno del servidor" },
      { status: 500 }
    );
  }
}
