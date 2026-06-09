import { cn } from "@/lib/utils";

/**
 * LogoIcon — square brand mark ("c.io" on a rounded brand-blue tile).
 *
 * Used for square 1:1 slots where the full wordmark doesn't fit: favicon-style
 * chips, avatars, collapsed/mobile spots, and inside UI mockups. Pure CSS/text,
 * so it stays pixel-sharp at any size. Brand blue reads on both light & dark.
 */
export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center bg-primary font-bold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        fontSize: Math.round(size * 0.4),
        letterSpacing: "-0.04em",
        lineHeight: 1,
      }}
      aria-label="control.io"
    >
      c.io
    </span>
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
