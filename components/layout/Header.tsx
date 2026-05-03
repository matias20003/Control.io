import { LogoFull } from "@/components/layout/Logo";
import { PushProvider } from "@/components/push/PushProvider";

export function Header() {
  return (
    <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-background/80 backdrop-blur-md border-b border-border">
      <LogoFull size="sm" />
      <PushProvider />
    </header>
  );
}
