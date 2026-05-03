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
            "w-full h-11 px-3 pr-9 rounded-lg",
            "bg-surface border border-border",
            "text-sm text-foreground",
            "transition-colors duration-150",
            "hover:border-muted-2",
            "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/70",
            "appearance-none cursor-pointer",
            "disabled:opacity-40 disabled:cursor-not-allowed",
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
