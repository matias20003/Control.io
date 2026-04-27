import { Bell } from "lucide-react";
import { LogoFull } from "@/components/layout/Logo";

export function Header() {
  return (
    <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-md border-b border-border">
      <LogoFull size="sm" />
      <button
        aria-label="Notificaciones"
        className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-all"
      >
        <Bell size={20} strokeWidth={1.8} />
      </button>
    </header>
  );
}
