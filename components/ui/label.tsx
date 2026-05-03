import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-xs font-semibold text-muted uppercase tracking-[0.06em]",
      "leading-none select-none",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
