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
import { getLatestEdition, hasUnreadTodayEdition } from "@/lib/db/newsletter";
import { getPendingReminders } from "@/lib/db/reminders";
import { getAgenda } from "@/lib/db/agenda";
import type { AppNotification } from "@/components/layout/NotificationCenter";
import { DeviceSessionTracker } from "@/components/DeviceSessionTracker";
import { prisma } from "@/lib/prisma";

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
  const [newsletterUnread, latestEdition, reminders, agenda, reports] = await Promise.all([
    hasUnreadTodayEdition(user.id).catch(() => false),
    getLatestEdition(user.id).catch(() => null),
    getPendingReminders(user.id).catch(() => []),
    getAgenda(user.id, 7).catch(() => []),
    prisma.reportDelivery.findMany({
      where: { userId: user.id, user: { reportNotifyApp: true } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, title: true, summary: true, publicToken: true },
    }).catch(() => []),
  ]);
  const notifications: AppNotification[] = [];

  if (newsletterUnread && latestEdition) {
    notifications.push({
      id: `newsletter-${latestEdition.id}`,
      kind: "newsletter",
      title: "Tu newsletter de hoy está listo",
      description: latestEdition.summary,
      href: "/newsletter",
    });
  }

  for (const reminder of reminders) {
    const when = new Date(reminder.remindAt).toLocaleString("es-AR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    notifications.push({
      id: `reminder-${reminder.id}`,
      kind: "reminder",
      title: reminder.text,
      description: `Recordatorio programado para ${when}`,
      href: "/calendario",
    });
  }

  for (const event of agenda) {
    notifications.push({
      id: `due-${event.id}`,
      kind: "due",
      title: event.title,
      description: `${event.dateLabel}: ${event.subtitle}`,
      href: "/agenda",
    });
  }
  for (const report of reports) {
    notifications.push({
      id: `report-${report.id}`,
      kind: "report",
      title: report.title,
      description: `${report.summary}. Tocá para abrir el PDF.`,
      href: `/api/reports/pdf/${report.publicToken}`,
    });
  }
  // "Correos" (bandeja unificada) solo para el dueño.
  const isOwner = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
  const showMyCircle = true;

  return (
    <div className="ambient-mesh min-h-dvh bg-background">
      <Sidebar newsletterUnread={newsletterUnread} isOwner={isOwner} showMyCircle={showMyCircle} />
      <Header name={name} email={user.email ?? ""} notifications={notifications} />
      <Calculator />
      <DeviceSessionTracker />
      <main className="min-h-dvh min-w-0 w-full overflow-x-clip pb-[calc(7rem+env(safe-area-inset-bottom))] md:ml-60 md:w-auto md:pb-0">
        <Topbar name={name} email={user.email ?? ""} notifications={notifications} />
        <InstallBanner />
        {children}
      </main>
      <BottomNav newsletterUnread={newsletterUnread} isOwner={isOwner} showMyCircle={showMyCircle} />
      <FeedbackButton registeredAt={user.created_at} />
    </div>
  );
}
