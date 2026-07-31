"use client";

import { useEffect, useState } from "react";

/** Franja horaria del saludo. Madrugada cuenta como noche. */
export function greetingFor(hour: number): string {
  if (hour >= 6 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

/** Primer nombre, con la inicial en mayúscula (el fallback sale del email). */
function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/**
 * Saludo según la hora. El servidor manda la franja calculada en hora de
 * Argentina para que el primer render ya sea el correcto (sin parpadeo); al
 * montar se recalcula con la hora real del dispositivo y se reprograma en el
 * próximo cambio de franja, así el saludo no queda viejo con la app abierta.
 */
export function Greeting({ name, initial }: { name: string; initial: string }) {
  const [greeting, setGreeting] = useState(initial);

  useEffect(() => {
    let timer: number;

    const tick = () => {
      const now = new Date();
      const hour = now.getHours();
      setGreeting(greetingFor(hour));

      const nextBoundary = hour < 6 ? 6 : hour < 12 ? 12 : hour < 20 ? 20 : 24;
      const next = new Date(now);
      next.setHours(nextBoundary, 0, 0, 0);
      timer = window.setTimeout(tick, next.getTime() - now.getTime() + 1_000);
    };

    tick();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <h1 className="text-2xl md:text-3xl tracking-tight">
      <span className="font-medium text-muted">{greeting}, </span>
      <span className="font-bold text-foreground">{firstName(name)}</span>
    </h1>
  );
}
