"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

/**
 * Feedback de testers. En vez de un botón flotante permanente (que tapaba
 * contenido), usa:
 *  1. Un popup que aparece UNA SOLA VEZ, a los 5 días del registro, y nunca más.
 *  2. Acceso on-demand desde el menú de usuario, vía el evento "feedback:open".
 */
const SHOWN_KEY = "control:fb-shown";
const DELAY_DAYS = 5;

export function FeedbackButton({ registeredAt }: { registeredAt?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);     // modal
  const [prompt, setPrompt] = useState(false); // popup
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const markShown = () => { try { localStorage.setItem(SHOWN_KEY, "1"); } catch {} };

  // Abrir el modal desde cualquier lado (menú de usuario) sin acoplar componentes.
  useEffect(() => {
    const handler = () => { setOpen(true); setPrompt(false); };
    window.addEventListener("feedback:open", handler);
    return () => window.removeEventListener("feedback:open", handler);
  }, []);

  // Popup: una sola vez, recién a los 5 días del registro. Después, nunca más.
  useEffect(() => {
    if (!registeredAt) return;
    let shown = false;
    try { shown = localStorage.getItem(SHOWN_KEY) === "1"; } catch {}
    if (shown) return;
    const days = (Date.now() - new Date(registeredAt).getTime()) / 86_400_000;
    if (days < DELAY_DAYS) return;
    const t = setTimeout(() => { setPrompt(true); markShown(); }, 6000); // a los ~6s
    return () => clearTimeout(t);
  }, [registeredAt]);

  const snooze = () => {
    setPrompt(false);
    markShown();
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
      markShown();
    } catch {
      toast.error("No pudimos enviar tu feedback");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Popup ocasional — centrado al frente de todo (sobre el menú) */}
      {prompt &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={snooze}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl animate-sheet-up"
            >
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
              <div className="mt-4 flex justify-end gap-2">
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
              data-keyboard-aware-modal
              onSubmit={submit}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[calc(var(--visual-viewport-height,100dvh)-1rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
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
