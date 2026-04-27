import { cn } from "@/lib/utils";

export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="control.io"
    >
      {/* Outer ring with gap at bottom */}
      <path
        d="M20 6 A14 14 0 1 1 9 31"
        stroke="#38BDF8"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Power button vertical line */}
      <line x1="20" y1="7" x2="20" y2="19" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
      {/* Arrow top-right */}
      <polyline points="27,9 33,3 33,9" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="27" y1="9" x2="33" y2="3" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LogoFull({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const textSizes = { sm: "text-sm", md: "text-lg", lg: "text-2xl" };
  const iconSizes = { sm: 22, md: 28, lg: 36 };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoIcon size={iconSizes[size]} />
      <span className={cn("font-bold tracking-tight", textSizes[size])}>
        <span className="text-foreground">control</span>
        <span className="text-primary">.io</span>
      </span>
    </div>
  );
}
