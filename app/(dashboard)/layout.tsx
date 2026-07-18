import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Topbar } from "@/components/layout/Topbar";
import { Calculator } from "@/components/Calculator";
import { InstallBanner } from "@/components/InstallApp";
import { FeedbackButton } from "@/components/FeedbackButton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrCreateProfile } from "@/lib/db/profile";
import { hasUnreadTodayEdition } from "@/lib/db/newsletter";

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

  const name = user.user_metadata?.name || user.email?.split("@")[0] || "Usuario";
  const newsletterUnread = await hasUnreadTodayEdition(user.id).catch(() => false);

  return (
    <div className="ambient-mesh min-h-dvh bg-background">
      <Sidebar newsletterUnread={newsletterUnread} />
      <Header name={name} email={user.email ?? ""} />
      <Calculator />
      <main className="md:ml-60 pb-20 md:pb-0 min-h-dvh">
        <Topbar name={name} email={user.email ?? ""} />
        <InstallBanner />
        {children}
      </main>
      <BottomNav newsletterUnread={newsletterUnread} />
      <FeedbackButton registeredAt={user.created_at} />
    </div>
  );
}
