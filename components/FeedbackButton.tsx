"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

/**
 * Botón flotante de feedback para testers del beta. Abre un modal con un
 * textarea y manda el reporte (+ la página actual) a /api/feedback.
 */
export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

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
    } catch {
      toast.error("No pudimos enviar tu feedback");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Botón flotante — sobre el bottom nav en mobile, abajo a la derecha en desktop */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Enviar feedback"
        className="fixed right-4 bottom-32 z-[45] flex items-center gap-2 rounded-full border border-primary/40 bg-surface/95 px-5 py-3.5 text-sm font-semibold text-primary shadow-xl backdrop-blur-md transition-colors hover:bg-surface md:bottom-6"
      >
        <MessageSquarePlus size={22} />
        <span className="hidden sm:inline">Feedback</span>
      </button>

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
