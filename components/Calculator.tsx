"use client";

import { useEffect, useState } from "react";
import { Calculator as CalculatorIcon, Delete } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Op = "+" | "-" | "×" | "÷";

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "×": return a * b;
    case "÷": return b === 0 ? 0 : a / b;
  }
}

// Formato AR: separador decimal coma, hasta 6 decimales sin trailing zeros.
function fmt(n: number): string {
  if (!isFinite(n)) return "0";
  const fixed = Math.round(n * 1e6) / 1e6;
  return fixed.toString().replace(".", ",");
}

export function Calculator() {
  const [open, setOpen]           = useState(false);
  const [display, setDisplay]     = useState("0");
  const [prev, setPrev]           = useState<number | null>(null);
  const [op, setOp]               = useState<Op | null>(null);
  const [resetNext, setResetNext] = useState(false);

  // Atajo de teclado global: tecla "c" abre la calculadora.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "c" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Soporte para usar teclas dentro de la calculadora cuando está abierta.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === ",")  press(",");
      else if (e.key === ".")  press(",");
      else if (e.key === "+")  press("+");
      else if (e.key === "-")  press("-");
      else if (e.key === "*")  press("×");
      else if (e.key === "/")  { e.preventDefault(); press("÷"); }
      else if (e.key === "Enter" || e.key === "=") press("=");
      else if (e.key === "Backspace") press("←");
      else if (e.key === "Escape")    press("C");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, display, prev, op, resetNext]);

  function press(key: string) {
    if (/^\d$/.test(key)) {
      if (resetNext || display === "0") {
        setDisplay(key);
        setResetNext(false);
      } else if (display.replace(/[^\d]/g, "").length < 14) {
        setDisplay((d) => d + key);
      }
      return;
    }
    if (key === ",") {
      if (resetNext) { setDisplay("0,"); setResetNext(false); return; }
      if (!display.includes(",")) setDisplay((d) => d + ",");
      return;
    }
    if (key === "←") {
      if (resetNext) return;
      setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : "0"));
      return;
    }
    if (key === "C") {
      setDisplay("0"); setPrev(null); setOp(null); setResetNext(false);
      return;
    }
    if (key === "±") {
      setDisplay((d) => (d.startsWith("-") ? d.slice(1) : d === "0" ? d : "-" + d));
      return;
    }
    if (key === "%") {
      const n = parseFloat(display.replace(",", ".")) / 100;
      setDisplay(fmt(n));
      setResetNext(true);
      return;
    }
    if (["+", "-", "×", "÷"].includes(key)) {
      const current = parseFloat(display.replace(",", "."));
      if (prev !== null && op && !resetNext) {
        const r = compute(prev, current, op);
        setPrev(r);
        setDisplay(fmt(r));
      } else {
        setPrev(current);
      }
      setOp(key as Op);
      setResetNext(true);
      return;
    }
    if (key === "=") {
      if (prev !== null && op) {
        const current = parseFloat(display.replace(",", "."));
        const r = compute(prev, current, op);
        setDisplay(fmt(r));
        setPrev(null); setOp(null); setResetNext(true);
      }
      return;
    }
  }

  const Btn = ({ k, label, variant = "num", span = 1 }: {
    k: string; label?: React.ReactNode; variant?: "num" | "op" | "fn" | "eq"; span?: 1 | 2;
  }) => (
    <button
      type="button"
      onClick={() => press(k)}
      className={cn(
        "h-14 rounded-xl text-base font-semibold transition-colors active:scale-[0.97]",
        "flex items-center justify-center select-none",
        span === 2 && "col-span-2",
        variant === "num" && "bg-surface-2 text-foreground hover:bg-surface-3",
        variant === "op"  && "bg-primary/15 text-primary hover:bg-primary/25",
        variant === "fn"  && "bg-surface text-muted hover:text-foreground hover:bg-surface-2 border border-border",
        variant === "eq"  && "bg-primary text-background hover:bg-primary-dark",
        op === k && variant === "op" && "bg-primary text-background",
      )}
    >
      {label ?? k}
    </button>
  );

  return (
    <>
      {/* Botón flotante: arriba al centro siempre. En desktop offset del sidebar (15rem / 2 = 7.5rem). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir calculadora"
        title="Calculadora (C)"
        className={cn(
          "fixed z-30",
          "top-2 md:top-3",
          "left-1/2 -translate-x-1/2",
          "md:left-[calc(50%+7.5rem)]",
          "h-9 w-9 md:h-10 md:w-10 rounded-full",
          "bg-primary text-background",
          "shadow-[0_4px_16px_oklch(0.67_0.19_258/35%)]",
          "hover:bg-primary-dark active:scale-95",
          "transition-all duration-150",
          "flex items-center justify-center",
        )}
      >
        <CalculatorIcon size={16} strokeWidth={2.2} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Calculadora" className="max-w-xs">
          {/* Display */}
          <div className="bg-surface-2 rounded-xl p-4 mb-3 text-right">
            {op && prev !== null && (
              <p className="text-xs text-muted font-mono mb-1">
                {fmt(prev)} {op}
              </p>
            )}
            <p className="text-3xl font-bold font-mono text-foreground tabular-nums break-all">
              {display}
            </p>
          </div>

          {/* Teclado 4×5 */}
          <div className="grid grid-cols-4 gap-2">
            <Btn k="C"  variant="fn" />
            <Btn k="±"  variant="fn" />
            <Btn k="%"  variant="fn" />
            <Btn k="÷"  variant="op" />

            <Btn k="7" variant="num" />
            <Btn k="8" variant="num" />
            <Btn k="9" variant="num" />
            <Btn k="×" variant="op" />

            <Btn k="4" variant="num" />
            <Btn k="5" variant="num" />
            <Btn k="6" variant="num" />
            <Btn k="-" variant="op" />

            <Btn k="1" variant="num" />
            <Btn k="2" variant="num" />
            <Btn k="3" variant="num" />
            <Btn k="+" variant="op" />

            <Btn k="0" variant="num" span={2} />
            <Btn k="," variant="num" />
            <Btn k="=" variant="eq" />
          </div>

          {/* Hint sutil */}
          <p className="text-[10px] text-muted text-center mt-3">
            Atajo: tocá <kbd className="font-mono text-foreground">C</kbd> para abrir/cerrar · <kbd className="font-mono text-foreground">Esc</kbd> limpia
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
