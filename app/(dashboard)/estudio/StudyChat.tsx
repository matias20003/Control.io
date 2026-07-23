"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Send, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; actions?: string[] };

const SUGGESTIONS = [
  "¿Qué tengo que estudiar hoy?",
  "Agregá la materia Análisis Matemático II (AM2)",
  "Creá un bloque de Integrales dobles en AM2",
  "Agendá el segundo parcial de AM2 para el 15/08",
];

export function StudyChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/estudio/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      if (data.error) {
        setMsgs((m) => [...m, { role: "assistant", content: `Uf, ${data.error}` }]);
      } else {
        setMsgs((m) => [...m, { role: "assistant", content: data.reply || "Listo.", actions: data.actions }]);
        if (data.actions?.length) router.refresh(); // reflejar cambios en el sistema
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "No pude conectar. Probá de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-transform active:scale-95 md:bottom-6"
          aria-label="Asistente de estudio"
        >
          <Sparkles size={18} /> <span className="hidden sm:inline">Asistente</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-end sm:inset-auto sm:bottom-6 sm:right-4">
          <div className="flex h-[82dvh] w-full flex-col rounded-t-3xl border border-border bg-surface shadow-2xl sm:h-[560px] sm:w-[380px] sm:rounded-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><Sparkles size={16} /></span>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">Asistente de estudio</p>
                  <p className="text-[11px] text-muted leading-tight">Pedile cambios en tu sistema</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted hover:text-foreground"><X size={18} /></button>
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Hola 👋 Controlá tu estudio hablando: crear materias, bloques, exámenes, o preguntar qué estudiar hoy.
                  </p>
                  <div className="space-y-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => send(s)} className="block w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-left text-xs text-foreground hover:border-primary/50">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user" ? "bg-primary text-white rounded-br-sm" : "bg-surface-2 text-foreground rounded-bl-sm"
                  )}>
                    {m.content}
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                        {m.actions.map((a, j) => (
                          <p key={j} className="flex items-center gap-1.5 text-[11px] text-success">
                            <CheckCircle2 size={12} /> {a}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-2.5">
                    <Loader2 size={15} className="animate-spin text-muted" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder="Escribí lo que querés hacer…"
                  rows={1}
                  className="max-h-28 flex-1 resize-none rounded-xl border border-border bg-surface-2/40 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
                />
                <button
                  onClick={() => send(input)}
                  disabled={loading || !input.trim()}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white disabled:opacity-40"
                  aria-label="Enviar"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
