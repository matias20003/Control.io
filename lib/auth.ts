import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Cached getCurrentUser — se ejecuta una sola vez por render,
 * aunque múltiples server components la llamen.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});
