"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

export function DialogTrigger({ children }: { children: React.ReactNode }) {
  return (
    <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>
  );
}

interface DialogContentProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function DialogContent({
  title,
  description,
  children,
  className,
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-40",
          "bg-background/80 backdrop-blur-[6px]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "duration-200"
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
          "w-[calc(100vw-2rem)] max-w-md",
          "bg-surface border border-border rounded-2xl",
          "shadow-[0_24px_64px_oklch(0_0_0/60%)]",
          "p-6",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]",
          "data-[state=open]:slide-in-from-top-[2%]",
          "data-[state=closed]:slide-out-to-top-[2%]",
          "duration-200",
          className
        )}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <DialogPrimitive.Title className="text-base font-semibold text-foreground tracking-tight leading-tight">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-sm text-muted mt-1 leading-relaxed">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close asChild>
            <button
              className={cn(
                "ml-4 -mt-0.5 -mr-0.5 p-1.5 rounded-lg",
                "text-muted hover:text-foreground hover:bg-surface-2",
                "transition-colors duration-150 flex-shrink-0"
              )}
            >
              <X size={15} strokeWidth={2} />
            </button>
          </DialogPrimitive.Close>
        </div>

        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
