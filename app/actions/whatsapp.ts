"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setWhatsappNumber, normalizeWhatsapp } from "@/lib/db/profile";

const schema = z.object({
  number: z
    .string()
    .trim()
    .transform((v) => normalizeWhatsapp(v))
    .refine((v) => v.length >= 8 && v.length <= 15, "Número inválido. Incluí el código de país, ej: 54 9 11 1234 5678"),
});

export async function updateWhatsappNumberAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const result = schema.safeParse({ number: (formData.get("number") as string) ?? "" });
  if (!result.success) return { error: result.error.issues[0].message };

  try {
    const saved = await setWhatsappNumber(
      user.id,
      user.email!,
      user.user_metadata?.name as string | undefined,
      result.data.number
    );
    revalidatePath("/configuracion");
    return { success: true, number: saved };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return { error: "Ese número de WhatsApp ya está vinculado a otra cuenta." };
    }
    return { error: "Error al guardar el número" };
  }
}

export async function removeWhatsappNumberAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    await setWhatsappNumber(user.id, user.email!, user.user_metadata?.name as string | undefined, null);
    revalidatePath("/configuracion");
    return { success: true };
  } catch {
    return { error: "Error al desvincular el número" };
  }
}
