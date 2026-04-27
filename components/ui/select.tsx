import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "w-full px-3 py-2.5 pr-9 rounded-xl",
            "bg-surface border border-border",
            "text-foreground text-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary",
            "transition-all appearance-none cursor-pointer",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };
