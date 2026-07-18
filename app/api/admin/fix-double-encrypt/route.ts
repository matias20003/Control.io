import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt, isEncrypted } from "@/lib/crypto";

// Limpieza única (admin-only): arregla los movimientos generados por el cron de
// gastos fijos que quedaron DOBLE-ENCRIPTADOS. El cron viejo hacía
// encrypt(r.description) sobre un valor que YA venía encriptado desde la tabla
// de recurrentes, así que al desencriptar en la lista quedaba "enc:...".
//
// Detección: si decrypt(description) SIGUE empezando con "enc:", estaba doble
// encriptado. Guardamos ese valor interno (el correctamente single-encriptado).
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const rows = await prisma.transaction.findMany({
      select: { id: true, description: true, notes: true },
    });

    let fixed = 0;
    for (const row of rows) {
      const patch: Record<string, string> = {};

      const innerDesc = decrypt(row.description);
      if (innerDesc && isEncrypted(innerDesc)) patch.description = innerDesc;

      const innerNotes = decrypt(row.notes);
      if (innerNotes && isEncrypted(innerNotes)) patch.notes = innerNotes;

      if (Object.keys(patch).length) {
        await prisma.transaction.update({ where: { id: row.id }, data: patch });
        fixed++;
      }
    }

    return Response.json({
      ok: true,
      fixed,
      message: fixed > 0
        ? `${fixed} movimientos corregidos (doble-encriptado revertido).`
        : "No había movimientos doble-encriptados.",
    });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Error interno" }, { status: 500 });
  }
}
