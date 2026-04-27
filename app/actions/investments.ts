"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createInvestment, deleteInvestment } from "@/lib/db/investments";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  type: z.enum([
    "USD_OFICIAL",
    "USD_BLUE",
    "USD_MEP",
    "USD_CCL",
    "CRYPTO",
    "FIXED_TERM",
    "STOCKS",
    "BONDS",
    "FUND",
    "OTHER",
  ]),
  currency: z.string().min(1),
  amount: z.coerce.number().positive("El monto debe ser positivo"),
  currentValue: z.coerce.number().optional(),
  ticker: z.string().optional(),
  units: z.coerce.number().optional(),
  purchaseDate: z.string().min(1, "La fecha es requerida"),
  notes: z.string().optional(),
});

export async function createInvestmentAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = {
    name: formData.get("name"),
    type: formData.get("type"),
    currency: formData.get("currency"),
    amount: formData.get("amount"),
    currentValue: formData.get("currentValue") || undefined,
    ticker: formData.get("ticker") || undefined,
    units: formData.get("units") || undefined,
    purchaseDate: formData.get("purchaseDate"),
    notes: formData.get("notes") || undefined,
  };

  const result = schema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  try {
    const inv = await createInvestment(user.id, result.data);
    revalidatePath("/inversiones");
    return { success: true, investment: inv };
  } catch {
    return { error: "Error al crear la inversión" };
  }
}

export async function deleteInvestmentAction(investmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  try {
    await deleteInvestment(user.id, investmentId);
    revalidatePath("/inversiones");
    return { success: true };
  } catch {
    return { error: "Error al eliminar la inversión" };
  }
}
