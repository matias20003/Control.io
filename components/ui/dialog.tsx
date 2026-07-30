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
          "fixed inset-0 z-[60]",
          "bg-background/80 backdrop-blur-[6px]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "duration-200"
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70]",
          "w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-md",
          // Límite de alto al viewport + columna flex: el header queda fijo y el
          // cuerpo scrollea. Sin esto, los formularios largos se salían de la
          // pantalla y el botón "Guardar" quedaba inalcanzable.
          "max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col",
          // Volvemos al fondo sólido. Combinar backdrop-filter en el overlay
          // con otro backdrop-filter en el content hace que Chrome desactive
          // el segundo: el contenido del modal queda invisible aunque el
          // overlay siga oscureciendo todo lo demás.
          "bg-surface border border-border rounded-2xl",
          "shadow-[0_24px_64px_oklch(0_0_0/60%)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]",
          "data-[state=open]:slide-in-from-top-[2%]",
          "data-[state=closed]:slide-out-to-top-[2%]",
          "duration-200",
          className
        )}
      >
        {/* Header — fijo */}
        <div className="flex items-start justify-between p-4 pb-3 sm:p-6 sm:pb-4 shrink-0">
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
              aria-label="Cerrar"
              className={cn(
                "ml-4 -mt-0.5 -mr-0.5 h-11 w-11 rounded-lg",
                "text-muted hover:text-foreground hover:bg-surface-2",
                "transition-colors duration-150 flex flex-shrink-0 items-center justify-center"
              )}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </DialogPrimitive.Close>
        </div>

        {/* Cuerpo — scrolleable */}
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6 sm:pb-6">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
