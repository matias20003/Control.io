"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { isStreakMilestone } from "@/lib/streak-utils";

// Mensaje de celebración por hito. Recompensa variable (Hooked): cada logro
// trae un mensaje distinto, así llegar a uno nuevo se siente especial.
const MSG: Record<number, string> = {
  3: "🔥 ¡3 días seguidos! Estás arrancando un hábito.",
  7: "🎉 ¡Una semana de racha! Ya tomás las riendas de tu plata 💪",
  14: "🚀 ¡14 días! Esto ya es costumbre.",
  30: "🏆 ¡30 días! Un mes entero al mando de tu plata.",
  60: "👑 ¡60 días! Sos imparable.",
  100: "💯 ¡100 días! Una leyenda de la constancia.",
  180: "🌟 ¡Medio año de racha! Increíble.",
  365: "🎂 ¡Un año entero registrando! Sos otro nivel.",
};

const KEY = "control:streak-celebrated";

/** Dispara un toast la PRIMERA vez que se alcanza un hito de racha. */
export function StreakCelebration({ current }: { current: number }) {
  useEffect(() => {
    if (!isStreakMilestone(current)) return;
    let celebrated = 0;
    try { celebrated = Number(localStorage.getItem(KEY)) || 0; } catch {}
    if (current <= celebrated) return; // ya lo celebramos
    toast(MSG[current] ?? `🔥 ¡Racha de ${current} días!`, { duration: 7000 });
    try { localStorage.setItem(KEY, String(current)); } catch {}
  }, [current]);
  return null;
}
