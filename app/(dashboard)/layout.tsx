import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrCreateProfile } from "@/lib/db/profile";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2FA es opcional. Si el user activó un factor pero la sesión sigue en aal1,
  // forzamos el desafío. Sin factor, lo dejamos pasar normalmente.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedFactor = factors?.totp?.some((f) => f.status === "verified") ?? false;
  if (hasVerifiedFactor) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") redirect("/login/verify");
  }

  await getOrCreateProfile(user.id, user.email!, user.user_metadata?.name);

  return (
    <div className="min-h-dvh bg-background">
      <Sidebar />
      <Header />
      <main className="md:ml-60 pb-20 md:pb-0 min-h-dvh">{children}</main>
      <BottomNav />
    </div>
  );
}
