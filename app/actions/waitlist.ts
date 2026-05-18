"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  email: z
    .string()
    .email("Ingresá un email válido")
    .max(120)
    .transform((v) => v.trim().toLowerCase()),
  name: z.string().min(1, "Decinos cómo te llamamos").max(60).transform((v) => v.trim()),
  profile: z.enum(["organize", "save_goals", "invest", "other"], {
    message: "Elegí una opción",
  }),
  source: z.string().max(40).optional(),
});

export async function subscribeToWaitlistAction(formData: FormData) {
  const raw = {
    email: formData.get("email"),
    name: formData.get("name"),
    profile: formData.get("profile"),
    source: formData.get("source") || undefined,
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, name, profile, source } = parsed.data;

  try {
    // Idempotente: si el email ya está en la lista, lo tratamos como éxito
    // pero distinguimos para mostrar copy diferente en la UI.
    const existing = await prisma.waitlistEntry.findUnique({
      where: { email },
      select: { id: true, createdAt: true },
    });

    if (existing) {
      const position = await prisma.waitlistEntry.count({
        where: { createdAt: { lte: existing.createdAt } },
      });
      return {
        success: true,
        already: true,
        position,
        message: `Ya estabas en la lista, ${name.split(" ")[0]}.`,
      };
    }

    const entry = await prisma.waitlistEntry.create({
      data: { email, name, profile, source: source ?? null },
      select: { id: true, createdAt: true },
    });

    const position = await prisma.waitlistEntry.count({
      where: { createdAt: { lte: entry.createdAt } },
    });

    return {
      success: true,
      already: false,
      position,
      message: `Estás dentro, ${name.split(" ")[0]}.`,
    };
  } catch {
    return { error: "No pudimos guardarte ahora. Probá de nuevo en un minuto." };
  }
}
