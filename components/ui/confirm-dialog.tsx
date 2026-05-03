"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { Button } from "./button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  isPending?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  onConfirm,
  isPending = false,
}: Props) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-[6px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-[0_24px_64px_oklch(0_0_0/60%)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-top-[2%] data-[state=closed]:slide-out-to-top-[2%] duration-200">
          <RadixDialog.Title className="text-base font-bold text-foreground mb-1">
            {title}
          </RadixDialog.Title>
          {description && (
            <RadixDialog.Description className="text-sm text-muted mb-5">
              {description}
            </RadixDialog.Description>
          )}
          <div className="flex gap-2 mt-5">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={variant === "danger" ? "danger" : "default"}
              className="flex-1"
              onClick={onConfirm}
              disabled={isPending}
            >
              {isPending ? "..." : confirmLabel}
            </Button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
