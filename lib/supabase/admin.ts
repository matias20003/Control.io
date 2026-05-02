import { createClient } from "@supabase/supabase-js";

// Only import this from server contexts (server actions, route handlers, server components).
// Uses SUPABASE_SERVICE_ROLE_KEY which must NEVER reach the browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
