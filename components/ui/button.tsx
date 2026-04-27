"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:   "bg-primary text-background hover:bg-primary-dark shadow-lg shadow-primary/20",
        secondary: "bg-surface text-foreground hover:bg-surface-2 border border-border",
        ghost:     "text-foreground hover:bg-surface hover:text-foreground",
        danger:    "bg-danger text-white hover:bg-danger/90 shadow-lg shadow-danger/20",
        outline:   "border border-primary text-primary hover:bg-primary/10",
        success:   "bg-success text-white hover:bg-success/90 shadow-lg shadow-success/20",
        muted:     "text-muted hover:text-foreground hover:bg-surface",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm:      "h-9 px-3 text-xs",
        lg:      "h-12 px-8 text-base",
        icon:    "h-10 w-10",
        "icon-sm": "h-8 w-8",
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
