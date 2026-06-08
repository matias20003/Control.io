"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

export function AppearanceCard() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
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
    <Card>
      <CardContent className="p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">Tema</p>
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => {
            const active = theme === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => apply(o.value)}
                aria-pressed={active}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition-all",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted hover:text-foreground hover:bg-surface-2"
                )}
              >
                <o.icon size={17} />
                {o.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">Elegí cómo se ve la app. Se guarda en este dispositivo.</p>
      </CardContent>
    </Card>
  );
}
