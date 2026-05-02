import { cn } from "@/lib/utils";

export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
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
      {/* Shield outline */}
      <path
        d="M32 6 L10 13 L10 32 C10 46 19 55 32 60 C45 55 54 46 54 32 L54 13 Z"
        stroke="#38BDF8"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />

      {/* Top-right highlight */}
      <path
        d="M42 9 L53 13 L53 25 L46 22 Z"
        fill="#7DD3FC"
        opacity="0.55"
      />

      {/* Checkmark */}
      <path
        d="M18 30 L27 39 L44 22"
        stroke="#38BDF8"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Circuit line 1 */}
      <circle cx="17" cy="44" r="2.4" fill="currentColor" />
      <line x1="19" y1="44" x2="40" y2="44" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="42" cy="44" r="2.4" fill="currentColor" />

      {/* Circuit line 2 */}
      <circle cx="22" cy="51" r="2.4" fill="currentColor" />
      <line x1="24" y1="51" x2="45" y2="51" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="47" cy="51" r="2.4" fill="currentColor" />
    </svg>
  );
}

export function LogoFull({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const textSizes = { sm: "text-sm", md: "text-lg", lg: "text-2xl" };
  const iconSizes = { sm: 24, md: 30, lg: 40 };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoIcon size={iconSizes[size]} className="text-foreground" />
      <span className={cn("font-bold tracking-tight", textSizes[size])}>
        <span className="text-foreground">control</span>
        <span className="text-primary">.io</span>
      </span>
    </div>
  );
}
