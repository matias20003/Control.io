import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { LogoFull } from "@/components/layout/Logo";
import { WaitlistForm } from "./WaitlistForm";

export const metadata: Metadata = {
  title: "Sumate a control.io — Lista de espera",
  description:
    "Estamos por abrir las puertas. Anotate y te avisamos primero, sin spam.",
};

export const dynamic = "force-dynamic";

export default async function WaitlistPage() {
  // Contador real para social proof. No fallamos la página si la DB
  // todavía no tiene la tabla (deploy previo a la migración).
  let count = 0;
  try {
    count = await prisma.waitlistEntry.count();
  } catch {
    count = 0;
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      {/* ─── Gradient Mesh background ────────────────────────────────
          Blobs grandes con blur extremo: el lenguaje visual nativo de
          gradient mesh (Stripe / Linear / Vercel). Colores derivados
          de la paleta OKLCH del proyecto para no romper la marca. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        {/* Blob principal índigo arriba-izquierda */}
        <div
          className="absolute -left-32 -top-40 h-[42rem] w-[42rem] rounded-full blur-[140px] opacity-[0.55]"
          style={{ background: "oklch(0.67 0.19 258)" }}
        />
        {/* Blob violeta arriba-derecha */}
        <div
          className="absolute -right-40 -top-24 h-[38rem] w-[38rem] rounded-full blur-[140px] opacity-[0.40]"
          style={{ background: "oklch(0.55 0.22 296)" }}
        />
        {/* Blob cyan abajo-izquierda */}
        <div
          className="absolute -left-32 bottom-[-12rem] h-[34rem] w-[34rem] rounded-full blur-[140px] opacity-[0.32]"
          style={{ background: "oklch(0.66 0.15 220)" }}
        />
        {/* Blob magenta abajo-derecha (más tenue, da "warmth") */}
        <div
          className="absolute -right-24 bottom-[-8rem] h-[30rem] w-[30rem] rounded-full blur-[120px] opacity-[0.25]"
          style={{ background: "oklch(0.65 0.22 350)" }}
        />

        {/* Grid sutil — patrón estilo Vercel para dar "tech feel" */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(0.96 0.005 258) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.96 0.005 258) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          }}
        />

        {/* Vignette dark en los bordes para "elevar" el contenido al centro */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,oklch(0.09_0.008_258/40%)_100%)]" />
      </div>

      {/* ─── Header simple ─── */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
        <LogoFull size="sm" />
        <a
          href="https://twitter.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden text-xs uppercase tracking-widest text-muted hover:text-foreground transition-colors sm:inline"
        >
          @control_io
        </a>
      </header>

      {/* ─── Hero + form ─── */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-7rem)] max-w-3xl flex-col items-center justify-center px-6 py-12 text-center sm:px-8">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] text-muted backdrop-blur-xl">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          Beta privada · Argentina
        </div>

        {/* Headline */}
        <h1 className="mt-8 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          Tu plata en pesos,
          <br className="hidden sm:block" />
          <span
            className="bg-gradient-to-r from-primary via-[oklch(0.72_0.18_286)] to-[oklch(0.72_0.15_220)] bg-clip-text text-transparent"
          >
            en dólares y en el banco
          </span>
          <br className="hidden sm:block" />
          <span className="text-foreground"> — en un solo lugar.</span>
        </h1>

        {/* Subhead */}
        <p className="mt-7 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          control.io reemplaza el Excel y los apps que venden tus datos.
          Estamos por abrir el acceso. Anotate y te avisamos primero, sin spam.
        </p>

        {/* Form */}
        <div className="mt-12 w-full max-w-md">
          <WaitlistForm />
        </div>

        {/* Trust strip */}
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-muted">
          <li className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-success" />
            Cifrado AES-256
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-success" />
            Sin tracking de terceros
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-success" />
            Acceso anticipado gratis
          </li>
        </ul>

        {/* Social proof */}
        {count > 0 && (
          <p className="mt-12 text-xs uppercase tracking-[0.18em] text-muted">
            <span className="font-mono text-foreground">
              {count.toLocaleString("es-AR")}
            </span>{" "}
            {count === 1 ? "persona anotada" : "personas anotadas"}
          </p>
        )}
      </section>

      {/* ─── Footer minimal ─── */}
      <footer className="relative z-10 mx-auto max-w-6xl px-6 pb-8 pt-4 text-center text-[11px] uppercase tracking-widest text-muted sm:px-8">
        © {new Date().getFullYear()} control.io · Tu plata, tu control.
      </footer>
    </main>
  );
}
