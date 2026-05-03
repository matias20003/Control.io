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
        /* ── Soft semantic variants — for quick-action income/expense buttons ── */
        income:
          "bg-success/10 text-success border border-success/20 rounded-lg hover:bg-success/16 hover:border-success/30 active:bg-success/20",
        expense:
          "bg-danger/10 text-danger border border-danger/20 rounded-lg hover:bg-danger/16 hover:border-danger/30 active:bg-danger/20",
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
