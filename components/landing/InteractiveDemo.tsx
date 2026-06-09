"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";

type Msg = { side: "in" | "out"; text: string; node?: React.ReactNode };

/* ── Parser de demo (cliente): monto + tipo + categoría ── */
const CATS: { re: RegExp; label: string; icon: string }[] = [
  { re: /s[uú]per|comida|almuerzo|cena|verdu|carnicer|kiosco|panader|resto|comer|burger|mcdonald|heladonline|helado|cafe|caf[eé]/, label: "Comida", icon: "🍔" },
  { re: /bondi|colectivo|uber|cabify|didi|taxi|nafta|sube|tren|subte|transporte|combustible|peaje/, label: "Transporte", icon: "🚗" },
  { re: /alquiler|expensas|luz|gas|agua|internet|wifi|hogar|casa|muebl/, label: "Hogar", icon: "🏠" },
  { re: /farmacia|medic|salud|m[eé]dico|dentista|remedio/, label: "Salud", icon: "💊" },
  { re: /netflix|spotify|cine|salida|boliche|joda|ocio|juego|stream|disney|hbo/, label: "Ocio", icon: "🎮" },
  { re: /ropa|zapatill|indument|shopping|remera|pantal/, label: "Ropa", icon: "👕" },
  { re: /libro|curso|facultad|cuota|materia|apunte|estudi|universidad|colegio/, label: "Educación", icon: "📚" },
];

function parseAmount(t: string): number {
  let m: RegExpMatchArray | null;
  if ((m = t.match(/(\d+(?:[.,]\d+)?)\s*(lucas?|k\b|mil\b)/))) return Math.round(parseFloat(m[1].replace(",", ".")) * 1000);
  if (/\bun palo\b/.test(t)) return 1_000_000;
  if ((m = t.match(/(\d+(?:[.,]\d+)?)\s*(palos?|millones?|melon|melones|melón)/))) return Math.round(parseFloat(m[1].replace(",", ".")) * 1_000_000);
  if ((m = t.match(/(\d[\d.]*)/))) return Math.round(parseFloat(m[1].replace(/\./g, "")));
  return 0;
}

function money(n: number) {
  return "$" + n.toLocaleString("es-AR");
}

function buildReply(raw: string): React.ReactNode {
  const t = raw.toLowerCase();
  const amount = parseAmount(t);
  if (!amount) {
    return <>No te entendí el monto 😅 Probá algo como <strong>“gasté 2 lucas en el súper”</strong>.</>;
  }
  const isIncome = /\b(gan[eé]|cobr[eé]|me pagaron|ingres|sueldo|me depositaron|entr[oó]|factur[eé])\b/.test(t);
  let cat = isIncome ? { label: "Ingreso", icon: "💰" } : { label: "Varios", icon: "💸" };
  if (!isIncome) {
    for (const c of CATS) {
      if (c.re.test(t)) {
        cat = { label: c.label, icon: c.icon };
        break;
      }
    }
  }
  const account = isIncome ? "Banco Galicia" : "Mercado Pago";
  const sign = isIncome ? "+" : "−";
  const dot = isIncome ? "🟢" : "🔴";
  return (
    <>
      {dot} <strong>{sign}{money(amount)}</strong> · {isIncome ? "Ingreso" : "Gasto"} registrado{"\n"}
      {cat.icon} {cat.label} · 🏦 {account}
    </>
  );
}

const SUGGESTIONS = [
  "gasté 2 lucas en el bondi",
  "1500 en el súper",
  "cobré 50 lucas",
  "pagué 8 lucas de la cuota de la facu",
];

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

function Bubble({ side, children }: { side: "in" | "out"; children: React.ReactNode }) {
  const out = side === "out";
  return (
    <motion.div
      className={`flex ${out ? "justify-end" : "justify-start"}`}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <div
        className={`max-w-[82%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px] leading-snug ${
          out ? "rounded-br-sm bg-emerald-700 text-white" : "rounded-bl-sm bg-surface-2 text-foreground"
        }`}
      >
        {children}
      </div>
    </motion.div>
  );
}

export function InteractiveDemo() {
  const [messages, setMessages] = useState<Msg[]>([
    { side: "in", text: "", node: <>¡Hola! 👋 Escribime un gasto o un ingreso y lo registro al toque. Probá uno de los ejemplos 👇</> },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    setInput("");
    setMessages((m) => [...m, { side: "out", text }]);
    setTyping(true);
    const reply = buildReply(text);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { side: "in", text: "", node: reply }]);
    }, 850);
  };

  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-widest text-emerald-400">
          <Sparkles className="h-3.5 w-3.5" /> Probalo ahora
        </span>
        <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          Escribí un gasto y <span className="text-primary">mirá la magia.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
          Así de fácil es cargar tu plata en control.io. Probá acá mismo — no necesitás crear cuenta.
        </p>
      </div>

      <div className="relative mx-auto mt-10 w-full max-w-md">
        <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-emerald-500/25 via-primary/15 to-transparent blur-2xl" />
        <div className="overflow-hidden rounded-[1.8rem] border border-border bg-surface shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 bg-emerald-600 px-4 py-3 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-base font-semibold">c</span>
            <div>
              <p className="text-sm font-semibold leading-tight">control.io</p>
              <p className="text-[11px] text-white/80">{typing ? "escribiendo…" : "demo en vivo"}</p>
            </div>
          </div>

          {/* Mensajes */}
          <div ref={bodyRef} className="h-[300px] space-y-2.5 overflow-y-auto bg-background/40 px-3 py-4 [scrollbar-width:none]">
            {messages.map((m, i) => (
              <Bubble key={i} side={m.side}>
                {m.node ?? m.text}
              </Bubble>
            ))}
            <AnimatePresence>
              {typing && (
                <motion.div className="flex justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-3">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-muted" animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                      ))}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sugerencias */}
          <div className="flex flex-wrap gap-2 border-t border-border bg-surface px-3 pt-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 bg-surface px-3 py-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: gasté 3 lucas en el almuerzo"
              className="h-10 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Enviar"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-background transition-colors hover:bg-primary-dark disabled:opacity-50"
              disabled={!input.trim() || typing}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
