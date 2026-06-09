import { cn } from "@/lib/utils";

/**
 * LogoIcon — standalone brand shield (icon-only, hand-crafted SVG).
 * Used where only the symbol is needed at very small sizes (e.g. mobile header).
 */
export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  const id = "cio";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="control.io"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38CCFF" />
          <stop offset="100%" stopColor="#1638E0" />
        </linearGradient>
      </defs>
      {/* Shield — open at lower-right (C-shape brand motif) */}
      <path
        d="M 52 36 L 52 18 L 44 8 L 32 4 L 20 8 L 12 18 L 12 36 Q 12 52 32 60 Q 44 56 50 46"
        stroke={`url(#${id}-g)`}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Checkmark */}
      <path
        d="M 20 30 L 28 40 L 44 20"
        stroke={`url(#${id}-g)`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Circuit lines */}
      <circle cx="20" cy="44" r="2.2" stroke="#6080B0" strokeWidth="1.5" fill="none" />
      <line x1="22" y1="44" x2="40" y2="44" stroke="#6080B0" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="42" cy="44" r="2.2" stroke="#6080B0" strokeWidth="1.5" fill="none" />
      <circle cx="24" cy="51" r="2.2" stroke="#6080B0" strokeWidth="1.5" fill="none" />
      <line x1="26" y1="51" x2="40" y2="51" stroke="#6080B0" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="42" cy="51" r="2.2" stroke="#6080B0" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

/**
 * LogoFull — full horizontal identity: vector shield + "control.io" wordmark + tagline.
 *
 * Built entirely from the vector LogoIcon + native text (no rasterised PNG), so it stays
 * pixel-sharp at any size and adapts to light/dark mode automatically:
 *   · "control"  → text-foreground (dark on light bg, light on dark bg)
 *   · ".io"      → text-primary (brand blue, legible on both themes)
 *   · tagline    → text-muted
 *
 * The `h` (icon height in px) drives every other dimension proportionally, so the wordmark
 * never distorts relative to the mark.
 */
export function LogoFull({
  className,
  size = "md",
}: {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "full";
}) {
  const heights: Record<string, number> = { xs: 32, sm: 44, md: 64, lg: 96, full: 96 };
  const h = heights[size];

  return (
    <div
      className={cn("flex items-center", className)}
      style={{ gap: Math.round(h * 0.2) }}
      aria-label="control.io"
    >
      <LogoIcon size={h} className="shrink-0" />
      <span className="flex flex-col" style={{ gap: Math.round(h * 0.06) }}>
        <span
          className="font-semibold leading-none tracking-tight"
          style={{ fontSize: Math.round(h * 0.46) }}
        >
          <span className="text-foreground">control</span>
          <span className="text-primary">.io</span>
        </span>
        <span
          className="font-medium uppercase leading-none text-muted"
          style={{
            fontSize: Math.max(7, Math.round(h * 0.135)),
            letterSpacing: Math.max(1, h * 0.05),
          }}
        >
          Systematic Efficiency
        </span>
      </span>
    </div>
  );
}
