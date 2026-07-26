"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { X, Loader2, RefreshCw, Check, RotateCcw, Sparkles, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateFlashcardsAction, getBlockFlashcardsAction, gradeFlashcardAction } from "@/app/actions/flashcards";
import { MathText } from "./MathText";
import type { BlockDTO } from "@/lib/db/study-system";

type Card = { id: string; question: string; answer: string; box: number };

export function FlashcardPractice({ block, onClose, onCount }: { block: BlockDTO; onClose: () => void; onCount?: (n: number) => void }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, start] = useTransition();
  const [genError, setGenError] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  // Al abrir, traemos las tarjetas existentes.
  useEffect(() => {
    getBlockFlashcardsAction(block.id).then((r) => {
      if (r.success) setCards(r.cards);
      else setCards([]);
    });
  }, [block.id]);

  const generate = () => {
    setGenError(null);
    start(async () => {
      const r = await generateFlashcardsAction(block.id);
      if (r.error) { setGenError(r.error); return; }
      if (r.success && r.cards) { setCards(r.cards); setI(0); setFlipped(false); setDone(0); onCount?.(r.cards.length); toast.success(`${r.cards.length} preguntas generadas de tu apunte`); }
    });
  };

  const grade = (known: boolean) => {
    if (!cards) return;
    const c = cards[i];
    gradeFlashcardAction(c.id, known).catch(() => {});
    setDone((d) => d + 1);
    if (i < cards.length - 1) { setI(i + 1); setFlipped(false); }
    else { setI(cards.length); } // fin
  };

  const restart = () => { setI(0); setFlipped(false); setDone(0); };

  const total = cards?.length ?? 0;
  const current = cards && i < total ? cards[i] : null;
  const finished = cards && total > 0 && i >= total;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-muted">{block.code} · {block.subjectCode}</p>
            <h3 className="text-base font-bold text-foreground flex items-center gap-1.5"><BrainCircuit size={16} className="text-primary" /> Practicar: {block.topic}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-foreground"><X size={18} /></button>
        </div>

        {/* Cargando lista */}
        {cards === null && (
          <div className="py-10 text-center text-sm text-muted"><Loader2 size={18} className="mx-auto animate-spin" /></div>
        )}

        {/* Sin tarjetas → generar */}
        {cards !== null && total === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-3">
            <Sparkles size={26} className="mx-auto text-primary" />
            <p className="text-sm text-foreground">Genero preguntas de recuperación activa <b>usando solo tu apunte</b> de este tema (sin inventar nada).</p>
            {genError && <p className="text-[12px] text-danger">{genError}</p>}
            <button onClick={generate} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Generar preguntas
            </button>
          </div>
        )}

        {/* Tarjeta actual */}
        {current && (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>Tarjeta {i + 1} de {total}</span>
              <button onClick={generate} disabled={busy} className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50" title="Regenerar preguntas del apunte">
                {busy ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Regenerar
              </button>
            </div>
            <button onClick={() => setFlipped((f) => !f)} className="w-full min-h-[150px] rounded-2xl border border-border bg-surface-2/40 p-5 text-left transition-colors hover:border-primary/40">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">{flipped ? "Respuesta" : "Pregunta"}</p>
              <MathText text={flipped ? current.answer : current.question} className="text-[15px] leading-relaxed text-foreground" />
              <p className="mt-3 text-[11px] text-muted">{flipped ? "Tocá para ver la pregunta" : "Tocá para ver la respuesta"}</p>
            </button>
            {!flipped ? (
              <button onClick={() => setFlipped(true)} className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">Mostrar respuesta</button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => grade(false)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/10">
                  <RotateCcw size={15} /> No la sabía
                </button>
                <button onClick={() => grade(true)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
                  <Check size={15} /> La sabía
                </button>
              </div>
            )}
          </>
        )}

        {/* Fin de la ronda */}
        {finished && (
          <div className="rounded-2xl border border-border bg-surface-2/30 p-6 text-center space-y-3">
            <Check size={26} className="mx-auto text-emerald-500" />
            <p className="text-sm font-semibold text-foreground">¡Terminaste la ronda! Repasaste {done} tarjeta(s).</p>
            <p className="text-[11px] text-muted">Las que no sabías vuelven pronto; las que sí, más espaciadas.</p>
            <button onClick={restart} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary/50"><RotateCcw size={14} /> Volver a empezar</button>
          </div>
        )}
      </div>
    </div>
  );
}
