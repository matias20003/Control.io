"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

/** Toggle compacto claro/oscuro para la sidebar. Misma lógica que AppearanceCard. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
    setMounted(true);
  }, []);

  const apply = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem("theme", t);
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle("light", t === "light");
  };

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "dark", label: "Oscuro", icon: Moon },
    { value: "light", label: "Claro", icon: Sun },
  ];

  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label="Tema">
      {options.map((o) => {
        // Antes de montar usamos el default para evitar parpadeo de selección.
        const active = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => apply(o.value)}
            aria-pressed={active}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all",
              active
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            )}
          >
            <o.icon size={13} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
