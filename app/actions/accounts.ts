"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createAccount, deleteAccount } from "@/lib/db/accounts";
import { z } from "zod";

const createAccountSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  type: z.enum([
    "CASH",
    "BANK",
    "DIGITAL_WALLET",
    "CREDIT_CARD",
    "SAVINGS",
    "INVESTMENT",
    "CRYPTO",
    "FOREIGN_CURRENCY",
  ]),
  currency: z.string().min(1, "La moneda es requerida"),
  balance: z.coerce.number(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export async function createAccountAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = {
    name: formData.get("name") as string,
    type: formData.get("type") as string,
    currency: formData.get("currency") as string,
    balance: formData.get("balance"),
    color: (formData.get("color") as string) || undefined,
    icon: (formData.get("icon") as string) || undefined,
  };

  const result = createAccountSchema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  try {
    const account = await createAccount(user.id, result.data);
    revalidatePath("/cuentas");
    revalidatePath("/dashboard");
    revalidatePath("/movimientos");
    return { success: true, account };
  } catch {
    return { error: "Error al crear la cuenta" };
  }
}

export async function deleteAccountAction(accountId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    await deleteAccount(user.id, accountId);
    revalidatePath("/cuentas");
    revalidatePath("/dashboard");
    revalidatePath("/movimientos");
    return { success: true };
  } catch {
    return { error: "Error al eliminar la cuenta" };
  }
}
