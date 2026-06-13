"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

/**
 * Feedback de testers. En vez de un botón flotante permanente (que tapaba
 * contenido), usa:
 *  1. Un popup OCASIONAL (cada ~3 días) que invita a dejar feedback, descartable.
 *  2. Acceso on-demand desde el menú de usuario, vía el evento "feedback:open".
 */
const PROMPT_KEY = "control:fb-prompt-at";
const PROMPT_EVERY = 3 * 24 * 60 * 60 * 1000; // 3 días

export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);     // modal
  const [prompt, setPrompt] = useState(false); // popup ocasional
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Abrir el modal desde cualquier lado (menú de usuario) sin acoplar componentes.
  useEffect(() => {
    const handler = () => { setOpen(true); setPrompt(false); };
    window.addEventListener("feedback:open", handler);
    return () => window.removeEventListener("feedback:open", handler);
  }, []);

  // Popup ocasional: solo si pasaron +3 días desde la última vez.
  useEffect(() => {
    let last = 0;
    try { last = Number(localStorage.getItem(PROMPT_KEY)) || 0; } catch {}
    if (Date.now() - last < PROMPT_EVERY) return;
    const t = setTimeout(() => setPrompt(true), 14000); // a los ~14s de uso
    return () => clearTimeout(t);
  }, []);

  const snooze = () => {
    setPrompt(false);
    try { localStorage.setItem(PROMPT_KEY, String(Date.now())); } catch {}
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (text.length < 3) {
      toast.error("Contanos un poco más 🙂");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, page: pathname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "No pudimos enviar tu feedback");
        return;
      }
      toast.success("¡Gracias por tu feedback! 🙌");
      setMessage("");
      setOpen(false);
      try { localStorage.setItem(PROMPT_KEY, String(Date.now())); } catch {}
    } catch {
      toast.error("No pudimos enviar tu feedback");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Popup ocasional — chico, descartable, arriba de la barra en mobile */}
      {prompt &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-24 right-3 left-3 z-[44] sm:bottom-5 sm:right-5 sm:left-auto sm:w-80 animate-sheet-up">
            <div className="relative rounded-2xl border border-border bg-surface p-4 shadow-2xl">
              <button
                type="button"
                onClick={snooze}
                aria-label="Cerrar"
                className="absolute right-2 top-2 rounded-lg p-1.5 text-muted hover:bg-surface-2"
              >
                <X size={15} />
              </button>
              <div className="flex items-center gap-2 pr-6">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <MessageSquarePlus size={16} />
                </span>
                <p className="text-sm font-semibold text-foreground">¿Cómo venís usando control.io?</p>
              </div>
              <p className="mt-2 text-xs text-muted">
                Si algo te molestó o se te ocurre una mejora, contanos — nos ayuda un montón. 🙏
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={snooze}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-2"
                >
                  Ahora no
                </button>
                <button
                  type="button"
                  onClick={() => { setPrompt(false); setOpen(true); }}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  Dar feedback
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => !sending && setOpen(false)}
          >
            <form
              onSubmit={submit}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-2xl"
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Contanos qué te pareció</p>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => !sending && setOpen(false)}
                  className="p-1.5 rounded-lg text-muted hover:bg-surface-2"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="mb-3 text-xs text-muted">
                ¿Algo no funcionó, te confundió o se te ocurre una mejora? Tu opinión nos ayuda un montón. 🙏
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                autoFocus
                maxLength={2000}
                placeholder="Ej: el botón de guardar no se ve bien en mi teléfono…"
                className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => !sending && setOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-surface-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Enviar
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
