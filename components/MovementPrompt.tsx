"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  hasMovementToday: boolean;
}

const STORAGE_KEY = "control:lastMovementPrompt";
const MIN_HOUR = 12;

export function MovementPrompt({ hasMovementToday }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasMovementToday) return;

    const today = new Date().toDateString();
    const lastPrompt = localStorage.getItem(STORAGE_KEY);
    if (lastPrompt === today) return;

    const hour = new Date().getHours();
    if (hour < MIN_HOUR) return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, [hasMovementToday]);

  const remember = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toDateString());
  };

  const dismiss = () => {
    remember();
    setOpen(false);
  };

  const choose = (type: "EXPENSE" | "INCOME") => {
    remember();
    setOpen(false);
    window.dispatchEvent(
      new CustomEvent("dashboard:open-quick-add", { detail: { type } })
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent title="¿Hiciste algún movimiento?" description="Cargalo ahora para no olvidarte.">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Button
            variant="expense"
            onClick={() => choose("EXPENSE")}
            className="h-24 flex-col gap-2 text-base"
          >
            <ArrowUpRight size={22} />
            Gasto
          </Button>
          <Button
            variant="income"
            onClick={() => choose("INCOME")}
            className="h-24 flex-col gap-2 text-base"
          >
            <ArrowDownLeft size={22} />
            Ingreso
          </Button>
        </div>
        <Button variant="ghost" onClick={dismiss} className="w-full h-11">
          No, todavía no
        </Button>
      </DialogContent>
    </Dialog>
  );
}
