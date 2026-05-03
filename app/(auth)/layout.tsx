import { LogoFull } from "@/components/layout/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="px-8 py-6">
        <LogoFull />
      </header>

      {/* Main: dos columnas en desktop, columna única en mobile */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </main>

      <footer className="py-5 text-center">
        <p className="text-xs text-muted-2 uppercase tracking-[0.12em]">
          systematic efficiency
        </p>
      </footer>
    </div>
  );
}
