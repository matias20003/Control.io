"use client";

/**
 * Botón de ojo: oculta (difumina) todos los importes del panel.
 *
 * En vez de que cada número se entere del estado, marcamos el <html> con
 * data-hide-values y el blur lo aplica una regla de CSS en globals.css sobre
 * el contenedor del dashboard. Así también quedan tapados los números que
 * dibujan los gráficos en SVG, que no pasan por React como texto.
 */
import { useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLocalValue } from "@/lib/client-store";

const STORAGE_KEY = "controlio:hide-values";

export function useValuesHidden(): [boolean, (hidden: boolean) => void] {
  const [raw, setRaw] = useLocalValue(STORAGE_KEY);
  return [raw === "1", (hidden: boolean) => setRaw(hidden ? "1" : "0")];
}

export function PrivacyToggle({ className }: { className?: string }) {
  const [hidden, setHidden] = useValuesHidden();

  useEffect(() => {
    document.documentElement.dataset.hideValues = hidden ? "true" : "false";
  }, [hidden]);

  return (
    <button
      type="button"
      onClick={() => setHidden(!hidden)}
      aria-pressed={hidden}
      aria-label={hidden ? "Mostrar los importes" : "Ocultar los importes"}
      title={hidden ? "Mostrar los importes" : "Ocultar los importes"}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground ${className ?? ""}`}
    >
      {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
}
