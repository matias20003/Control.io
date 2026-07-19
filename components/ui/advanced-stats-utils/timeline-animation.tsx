"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Revelado escalonado al hacer scroll (esencia del diseño advanced-stats).
 * Cada bloque aparece con fade + slide-up, con un delay proporcional a
 * `animationNum` para que la grilla "caiga" en cascada.
 */
export function TimelineAnimation({
  animationNum,
  timelineRef,
  children,
  className,
}: {
  animationNum: number;
  timelineRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: 0.5,
        delay: Math.min(animationNum, 8) * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

export { cn };
