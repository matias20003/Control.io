import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-lg px-4 py-2.5",
        "bg-surface border border-border",
        "text-sm text-foreground placeholder:text-muted",
        "transition-colors duration-150",
        "hover:border-muted-2",
        "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/70",
        "disabled:cursor-not-allowed disabled:opacity-40",
        // números: monospace solo en inputs type=number y type=text con datos financieros
        type === "number" && "font-mono tabular-nums",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
