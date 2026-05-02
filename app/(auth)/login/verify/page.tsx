import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LoginVerifyClient } from "./LoginVerifyClient";

export default async function LoginVerifyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect("/dashboard");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedFactor = factors?.totp?.some((f) => f.status === "verified");
  if (!hasVerifiedFactor) redirect("/setup-2fa");

  return <LoginVerifyClient />;
}
