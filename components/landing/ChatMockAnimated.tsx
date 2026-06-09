"use client";

import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mic } from "lucide-react";

type Msg = { side: "in" | "out"; audio?: boolean; node?: ReactNode };

const MESSAGES: Msg[] = [
  { side: "out", node: "gasté 5 lucas en el súper 🛒" },
  { side: "in", node: <>🔴 <strong>-$5.000</strong> · Súper{"\n"}🏷️ Comida · 🏦 Mercado Pago</> },
  { side: "out", audio: true },
  { side: "in", node: <>🟢 <strong>+$400.000</strong> · Sueldo{"\n"}🏦 Banco Galicia</> },
  { side: "out", node: "📷 (foto de un ticket)" },
  { side: "in", node: <>🔴 <strong>-$12.480</strong> · Farmacia{"\n"}🏷️ Salud · leí el total del ticket</> },
  { side: "out", node: "¿cómo vengo este mes?" },
  { side: "in", node: <>Vas <strong>+$311.610</strong> 👏{"\n"}Ahorraste <strong>24%</strong> más que en mayo. Tu mayor gasto es Comida. ¿Te armo un presupuesto?</> },
];

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

function Bubble({ side, audio, children }: { side: "in" | "out"; audio?: boolean; children?: ReactNode }) {
  const out = side === "out";
  return (
    <motion.div
      className={`flex ${out ? "justify-end" : "justify-start"}`}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div
        className={`max-w-[82%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-sm ${
          out ? "rounded-br-sm bg-emerald-700 text-white" : "rounded-bl-sm bg-[#202c33] text-slate-100"
        }`}
      >
        {audio ? (
          <span className="flex items-center gap-2 py-0.5">
            <Mic className="h-4 w-4 shrink-0" />
            <span className="h-1 w-28 rounded-full bg-white/40" />
            <span className="text-[11px] text-white/70">0:07</span>
          </span>
        ) : (
          children
        )}
      </div>
    </motion.div>
  );
}

function Typing() {
  return (
    <motion.div className="flex justify-start" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="rounded-2xl rounded-bl-sm bg-[#202c33] px-3.5 py-3">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-slate-400"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </span>
      </div>
    </motion.div>
  );
}

export function ChatMockAnimated() {
  const ref = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(setTimeout(r, ms)));

    (async () => {
      await wait(500);
      for (let i = 0; i < MESSAGES.length; i++) {
        if (cancelled) return;
        if (MESSAGES[i].side === "in") {
          setTyping(true);
          await wait(950);
          if (cancelled) return;
          setTyping(false);
        } else {
          await wait(450);
        }
        setShown(i + 1);
        await wait(MESSAGES[i].side === "in" ? 950 : 650);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [inView]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [shown, typing]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-emerald-500/30 via-primary/15 to-transparent blur-2xl" />
      <motion.div
        initial={{ opacity: 0, y: 30, rotateX: 8 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: EASE }}
        className="overflow-hidden rounded-[2rem] border border-border bg-surface shadow-2xl"
      >
        {/* Header WhatsApp */}
        <div className="flex items-center gap-3 bg-emerald-600 px-4 py-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-base font-semibold">c</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">control.io</p>
            <p className="text-[11px] text-white/80">{typing ? "escribiendo…" : "en línea"}</p>
          </div>
        </div>
        {/* Cuerpo */}
        <div className="h-[420px] space-y-2.5 overflow-y-auto bg-[#0b141a] px-3 py-4 [scrollbar-width:none]">
          {MESSAGES.slice(0, shown).map((m, i) => (
            <Bubble key={i} side={m.side} audio={m.audio}>
              {m.node}
            </Bubble>
          ))}
          <AnimatePresence>{typing && <Typing />}</AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </motion.div>
    </div>
  );
}
