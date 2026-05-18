"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-semibold tracking-[-0.01em] transition-all duration-150",
    "disabled:pointer-events-none disabled:opacity-40",
    "active:scale-[0.97] cursor-pointer select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-background rounded-lg shadow-[0_2px_8px_oklch(0.67_0.19_258/25%)] hover:bg-primary-dark hover:shadow-[0_4px_16px_oklch(0.67_0.19_258/35%)]",
        secondary:
          "bg-surface-2 text-foreground rounded-lg border border-border hover:bg-surface-3 hover:border-border",
        ghost:
          "text-muted rounded-lg hover:text-foreground hover:bg-surface-2",
        danger:
          "bg-danger text-white rounded-lg shadow-[0_2px_8px_oklch(0.62_0.22_27/25%)] hover:opacity-90",
        outline:
          "border border-primary/50 text-primary rounded-lg hover:bg-primary/10 hover:border-primary",
        success:
          "bg-success text-white rounded-lg shadow-[0_2px_8px_oklch(0.67_0.17_148/25%)] hover:opacity-90",
        muted:
          "text-muted rounded-lg hover:text-foreground hover:bg-surface-2",
        /* ── Soft semantic variants — for quick-action income/expense buttons.
           Sutil gradient interno + glow al hover para que se sientan vivos
           sin perder la sutileza de "soft semantic". */
        income:
          "bg-gradient-to-br from-success/15 to-success/[0.06] text-success border border-success/25 rounded-lg shadow-[inset_0_1px_0_oklch(0.96_0.005_258/8%)] hover:from-success/22 hover:to-success/10 hover:border-success/40 hover:shadow-[inset_0_1px_0_oklch(0.96_0.005_258/12%),0_8px_24px_oklch(0.67_0.17_148/22%)] active:scale-[0.985] transition-all duration-200",
        expense:
          "bg-gradient-to-br from-danger/15 to-danger/[0.06] text-danger border border-danger/25 rounded-lg shadow-[inset_0_1px_0_oklch(0.96_0.005_258/8%)] hover:from-danger/22 hover:to-danger/10 hover:border-danger/40 hover:shadow-[inset_0_1px_0_oklch(0.96_0.005_258/12%),0_8px_24px_oklch(0.62_0.22_27/22%)] active:scale-[0.985] transition-all duration-200",
      },
      size: {
        default:  "h-11 px-5 text-sm",
        sm:       "h-9 px-3.5 text-xs",
        lg:       "h-12 px-7 text-base",
        icon:     "h-10 w-10 rounded-lg",
        "icon-sm":"h-8 w-8 rounded-md text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
