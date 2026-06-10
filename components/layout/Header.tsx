import { LogoFull } from "@/components/layout/Logo";
import { PushProvider } from "@/components/push/PushProvider";
import { CalculatorTrigger } from "@/components/Calculator";
import { UserMenu } from "@/components/layout/UserMenu";

export function Header({ name, email }: { name: string; email: string }) {
  return (
    <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-2 glass-strong glass-highlight border-b border-[color:var(--glass-border)]">
      <LogoFull size="sm" />
      <div className="flex items-center gap-1.5">
        <CalculatorTrigger />
        <PushProvider />
        <UserMenu name={name} email={email} />
      </div>
    </header>
  );
}
