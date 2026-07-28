import { LogoFull } from "@/components/layout/Logo";
import { PushProvider } from "@/components/push/PushProvider";
import { CalculatorTrigger } from "@/components/Calculator";
import { UserMenu } from "@/components/layout/UserMenu";

export function Header({ name, email }: { name: string; email: string }) {
  return (
    <header
      className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 pb-2 glass-strong glass-highlight border-b border-[color:var(--glass-border)]"
      style={{
        paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))",
      }}
    >
      <LogoFull size="sm" />
      <div className="flex items-center gap-1.5">
        <CalculatorTrigger />
        <PushProvider />
        <UserMenu name={name} email={email} />
      </div>
    </header>
  );
}
