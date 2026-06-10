import { cn } from "@/lib/utils";

/**
 * LogoIcon — square brand mark: velocímetro azul sobre tile oscuro.
 *
 * Used for square 1:1 slots where the full wordmark doesn't fit: favicon-style
 * chips, avatars, collapsed/mobile spots, and inside UI mockups. SVG vectorial,
 * pixel-sharp a cualquier tamaño. Mismo diseño que app/icon.svg y los PNG PWA.
 */
export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("inline-block", className)}
      role="img"
      aria-label="control.io"
    >
      <defs>
        <linearGradient id="liTile" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1b2740" />
          <stop offset="1" stopColor="#0e1626" />
        </linearGradient>
        <linearGradient id="liGauge" x1="18" y1="48" x2="46" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1d4ed8" />
          <stop offset="0.55" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#7cb8ff" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#liTile)" />
      <path d="M 20 46 A 17 17 0 1 1 44 46" fill="none" stroke="#27324d" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M 20 46 A 17 17 0 1 1 44 46" fill="none" stroke="url(#liGauge)" strokeWidth="5.5" strokeLinecap="round" strokeDasharray="62 200" />
      <line x1="32" y1="34" x2="22" y2="24" stroke="#cfe2ff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="32" cy="34" r="3.6" fill="#0e1626" stroke="#5b9bff" strokeWidth="2" />
      <circle cx="32" cy="34" r="1.3" fill="#cfe2ff" />
    </svg>
  );
}

/**
 * LogoFull — horizontal identity: the "control.io" wordmark (+ optional tagline).
 *
 * Pure native text (no rasterised asset), so it's pixel-sharp at any size and
 * adapts to light/dark automatically:
 *   · "control"  → text-foreground (dark on light bg, light on dark bg)
 *   · ".io"      → text-primary (brand blue, legible on both themes)
 *   · tagline    → text-muted ("Entendé tu dinero.")
 *
 * `h` (cap reference in px) drives every dimension proportionally. The tagline
 * shows on the larger placements by default; pass `tagline` to force it.
 */
export function LogoFull({
  className,
  size = "md",
  tagline,
}: {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "full";
  tagline?: boolean;
}) {
  const heights: Record<string, number> = { xs: 32, sm: 44, md: 64, lg: 96, full: 96 };
  const h = heights[size];
  const showTagline = tagline ?? (size === "md" || size === "lg" || size === "full");

  return (
    <div className={cn("inline-flex flex-col", className)} aria-label="control.io">
      <span
        className="font-bold leading-none tracking-tight"
        style={{ fontSize: Math.round(h * 0.46) }}
      >
        <span className="text-foreground">control</span>
        <span className="text-primary">.io</span>
      </span>
      {showTagline && (
        <span
          className="font-medium uppercase leading-none text-muted"
          style={{
            fontSize: Math.max(8, Math.round(h * 0.135)),
            letterSpacing: Math.max(1, h * 0.05),
            marginTop: Math.round(h * 0.08),
          }}
        >
          Entendé tu dinero.
        </span>
      )}
    </div>
  );
}
