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
