import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const PICKER_TYPES = new Set(["date", "datetime-local", "month", "time", "week"]);

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onClick, ...props }, ref) => {
    // Para inputs con picker nativo (fecha, hora, etc.) forzamos la apertura del
    // calendario apenas el usuario toca el campo, sin requerir que apunte al ícono.
    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      if (type && PICKER_TYPES.has(type)) {
        try { e.currentTarget.showPicker(); } catch {}
      }
      onClick?.(e);
    };

    return (
      <input
        type={type}
        onClick={handleClick}
        className={cn(
          "flex h-11 w-full rounded-lg px-4 py-2.5",
          "bg-surface border border-border",
          "text-sm text-foreground placeholder:text-muted",
          "transition-colors duration-150",
          "hover:border-muted-2",
          "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/70",
          "disabled:cursor-not-allowed disabled:opacity-40",
          // Para inputs con picker, mostramos cursor pointer y damos prioridad
          // visual al campo entero (no solo al icono de la derecha).
          type && PICKER_TYPES.has(type) && "cursor-pointer",
          // números: monospace solo en inputs type=number y type=text con datos financieros
          type === "number" && "font-mono tabular-nums",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
