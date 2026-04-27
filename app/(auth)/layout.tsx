import { LogoFull } from "@/components/layout/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="px-6 py-5 border-b border-border">
        <LogoFull />
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="py-4 text-center">
        <p className="text-xs text-muted uppercase tracking-widest">systematic efficiency</p>
      </footer>
    </div>
  );
}
