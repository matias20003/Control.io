import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full px-4 py-2.5 rounded-lg",
          "bg-surface border border-border",
          "text-sm text-foreground placeholder:text-muted",
          "transition-colors duration-150",
          "hover:border-muted-2",
          "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/70",
          "resize-none",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
