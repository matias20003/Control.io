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
 * LogoFull — uses the real brand asset (logo-full.svg).
 * The SVG is the full horizontal identity: shield + "control.io" + "SYSTEMATIC EFFICIENCY".
 */
export function LogoFull({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  // Sizes aumentados — el SVG tiene padding interno, así que necesitamos altura generosa
  const heights: Record<string, number> = { sm: 44, md: 64, lg: 96 };
  const h = heights[size];

  return (
    <div className={cn("flex items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-full.svg"
        alt="control.io"
        height={h}
        style={{ height: h, width: "auto", maxWidth: "none" }}
        draggable={false}
      />
    </div>
  );
}
