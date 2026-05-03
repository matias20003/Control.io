import { LogoFull } from "@/components/layout/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background flex flex-col">

      {/* ── Logo — grande y centrado en mobile, izquierda en desktop ── */}
      <header className="flex justify-center md:justify-start px-8 pt-8 pb-2">
        {/* Mobile: logo sm */}
        <div className="md:hidden">
          <LogoFull size="sm" />
        </div>
        {/* Desktop: logo md */}
        <div className="hidden md:block">
          <LogoFull size="md" />
        </div>
      </header>

      {/* ── Animación de seguridad — solo mobile ── */}
      <div className="md:hidden flex justify-center items-center py-8">
        <div className="relative w-52 h-52 flex items-center justify-center">

          {/* Anillos pulsantes que se expanden */}
          <span
            className="auth-ring absolute inset-0 rounded-full border border-primary/35"
            style={{ "--delay": "2.4s" } as React.CSSProperties}
          />
          <span
            className="auth-ring absolute inset-0 rounded-full border border-primary/25"
            style={{ "--delay": "3.1s" } as React.CSSProperties}
          />
          <span
            className="auth-ring absolute inset-0 rounded-full border border-primary/15"
            style={{ "--delay": "3.8s" } as React.CSSProperties}
          />

          {/* Escudo SVG */}
          <svg
            viewBox="0 0 120 120"
            width="168"
            height="168"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="auth-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38CCFF" />
                <stop offset="100%" stopColor="#1638E0" />
              </linearGradient>
              {/* Glow filter */}
              <filter id="auth-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Relleno del escudo — aparece al final */}
            <path
              d="M60 8 L100 24 L100 68 Q100 100 60 114 Q20 100 20 68 L20 24 Z"
              fill="url(#auth-g)"
              fillOpacity="0.09"
              className="auth-fill"
            />

            {/* Contorno del escudo — se dibuja solo */}
            <path
              d="M60 8 L100 24 L100 68 Q100 100 60 114 Q20 100 20 68 L20 24 Z"
              stroke="url(#auth-g)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#auth-glow)"
              className="auth-shield"
            />

            {/* Tilde / checkmark — aparece después del escudo */}
            <path
              d="M38 62 L54 80 L84 42"
              stroke="url(#auth-g)"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#auth-glow)"
              className="auth-check"
            />
          </svg>

          {/* Puntos flotantes ambientales */}
          <span
            className="auth-float absolute w-2 h-2 rounded-full bg-primary/55 top-4 right-6"
            style={{ "--dur": "3.2s", "--delay": "2.6s" } as React.CSSProperties}
          />
          <span
            className="auth-float absolute w-1.5 h-1.5 rounded-full bg-primary/40 top-14 right-1"
            style={{ "--dur": "3.9s", "--delay": "3s" } as React.CSSProperties}
          />
          <span
            className="auth-float absolute w-2 h-2 rounded-full bg-primary/50 top-10 left-2"
            style={{ "--dur": "2.8s", "--delay": "3.3s" } as React.CSSProperties}
          />
          <span
            className="auth-float absolute w-1.5 h-1.5 rounded-full bg-primary/35 bottom-10 left-5"
            style={{ "--dur": "3.6s", "--delay": "2.8s" } as React.CSSProperties}
          />
          <span
            className="auth-float absolute w-1 h-1 rounded-full bg-primary/30 bottom-4 right-10"
            style={{ "--dur": "4.1s", "--delay": "3.5s" } as React.CSSProperties}
          />
        </div>
      </div>

      {/* ── Formulario ── */}
      <main className="flex-1 flex md:items-center justify-center px-6 pb-8 md:py-12">
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
