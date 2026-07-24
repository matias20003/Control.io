"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, Loader2, MessageCircle, Inbox } from "lucide-react";
import { setTicketStatusAction } from "@/app/actions/support";
import type { TicketDTO } from "@/lib/db/support";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function SupportTickets({ initial }: { initial: TicketDTO[] }) {
  const [tickets, setTickets] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();

  const toggle = (id: string, resolved: boolean) => {
    setBusyId(id);
    start(async () => {
      const res = await setTicketStatusAction(id, resolved);
      setBusyId(null);
      if (res.error) { toast.error(res.error); return; }
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: resolved ? "resuelto" : "abierto", resolvedAt: resolved ? new Date().toISOString() : null } : t)));
      toast.success(resolved ? "Ticket resuelto" : "Ticket reabierto");
    });
  };

  const open = tickets.filter((t) => t.status === "abierto");
  const done = tickets.filter((t) => t.status === "resuelto");

  const Card = ({ t }: { t: TicketDTO }) => (
    <div className={`rounded-xl border p-3.5 ${t.status === "abierto" ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-surface/40 opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{t.fromName || t.fromContact || "Usuario"}</p>
          {t.fromContact && t.fromName && <p className="text-[11px] text-muted">{t.fromContact}</p>}
        </div>
        <span className="text-[10px] text-muted shrink-0">{fmt(t.createdAt)}</span>
      </div>
      <p className="mt-1.5 text-sm text-foreground/90 whitespace-pre-wrap">{t.motivo}</p>
      <div className="mt-2.5 flex items-center gap-2">
        {t.status === "abierto" ? (
          <button onClick={() => toggle(t.id, true)} disabled={busyId === t.id} className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {busyId === t.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Marcar resuelto
          </button>
        ) : (
          <button onClick={() => toggle(t.id, false)} disabled={busyId === t.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50">
            {busyId === t.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Reabrir
          </button>
        )}
        {t.fromContact && /^\+?\d[\d\s-]+$/.test(t.fromContact) && (
          <a href={`https://wa.me/${t.fromContact.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground">
            <MessageCircle size={13} /> Responder por WhatsApp
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 p-4 md:p-8">
      <div className="flex items-center gap-2">
        <Inbox size={18} className="text-primary" />
        <h2 className="text-sm font-bold text-foreground">Tickets de soporte</h2>
        {open.length > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-500">{open.length} abierto(s)</span>}
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Sin tickets todavía. Cuando el bot derive una consulta que no pudo resolver, aparece acá.
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Abiertos · {open.length}</p>
              {open.map((t) => <Card key={t.id} t={t} />)}
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Resueltos · {done.length}</p>
              {done.map((t) => <Card key={t.id} t={t} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
