import { LogoFull } from "@/components/layout/Logo";
import { CalculatorTrigger } from "@/components/Calculator";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationCenter, type AppNotification } from "@/components/layout/NotificationCenter";

export function Header({ name, email, notifications }: { name: string; email: string; notifications: AppNotification[] }) {
  return (
    <header
      className="md:hidden sticky top-0 z-20 flex min-w-0 items-center justify-between gap-2 px-3 pb-2 min-[390px]:px-4 glass-strong glass-highlight border-b border-[color:var(--glass-border)]"
      style={{
        paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))",
      }}
    >
      <LogoFull size="sm" />
      <div className="flex shrink-0 items-center gap-0.5 min-[390px]:gap-1">
        <CalculatorTrigger />
        <NotificationCenter notifications={notifications} mobile />
        <UserMenu name={name} email={email} />
      </div>
    </header>
  );
}
