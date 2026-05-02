import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Setup2FAClient } from "./Setup2FAClient";

export default async function Setup2FAPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Si ya tiene factor verificado, no tiene sentido enrolar otro: mandalo a manejar 2FA.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedFactor = factors?.totp?.some((f) => f.status === "verified");
  if (hasVerifiedFactor) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") redirect("/configuracion");
    redirect("/login/verify");
  }

  return <Setup2FAClient />;
}
