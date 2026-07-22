"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Link2, Check, X, Download, Copy, RefreshCw, Database, CalendarDays } from "lucide-react";
import {
  connectNotionAction, importFromNotionAction, disconnectNotionAction, getIcsUrlAction,
  connectGcalAction, disconnectGcalAction, getCalendarEventsAction, importCalendarExamsAction,
} from "@/app/actions/study-system";
import type { SubjectDTO, BlockDTO } from "@/lib/db/study-system";

type CalEvt = { title: string; start: string; allDay: boolean };

export function NotionCalendar({
  subjects, notion, gcal, onImported,
}: {
  subjects: SubjectDTO[];
  notion: { connected: boolean; dbId: string | null; hasIcs: boolean };
  gcal: { connected: boolean };
  onImported: (blocks: BlockDTO[]) => void;
}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [dbId, setDbId] = useState(notion.dbId ?? "");
  const [connected, setConnected] = useState(notion.connected);
  const [subjectId, setSubjectId] = useState("");
  const [parcial, setParcial] = useState("1");
  const [icsUrl, setIcsUrl] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // Google Calendar
  const [gcalConnected, setGcalConnected] = useState(gcal.connected);
  const [gcalUrl, setGcalUrl] = useState("");
  const [events, setEvents] = useState<CalEvt[] | null>(null);
  const [gbusy, startG] = useTransition();

  const connectGcal = () => startG(async () => {
    const res = await connectGcalAction({ url: gcalUrl.trim() });
    if (res.error) { toast.error(res.error); return; }
    setGcalConnected(true); setGcalUrl("");
    toast.success(`Calendario conectado — ${res.count} evento(s) próximos`);
    loadEvents();
    router.refresh();
  });
  const loadEvents = () => startG(async () => {
    const res = await getCalendarEventsAction(21);
    if (res.error) { toast.error(res.error); return; }
    setEvents(res.events ?? []);
  });
  const importExams = () => startG(async () => {
    const res = await importCalendarExamsAction();
    if (res.error) { toast.error(res.error); return; }
    toast.success(res.imported ? `${res.imported} parcial(es) importados del calendario` : "No encontré parciales nuevos con materia reconocible");
    if (res.unmatched && res.unmatched.length) toast.message(`Sin materia detectada: ${res.unmatched.slice(0, 3).join(", ")}${res.unmatched.length > 3 ? "…" : ""}`);
    router.refresh();
  });
  const disconnectGcal = () => startG(async () => {
    await disconnectGcalAction();
    setGcalConnected(false); setEvents(null);
    toast.success("Calendario desconectado");
    router.refresh();
  });

  const connect = () => start(async () => {
    const res = await connectNotionAction({ token: token.trim(), dbId: dbId.trim() });
    if (res.error) { toast.error(res.error); return; }
    setConnected(true); setToken("");
    toast.success(`Conectado a Notion — ${res.count} fila(s) detectadas`);
    router.refresh();
  });

  const importNow = () => {
    if (!subjectId) { toast.error("Elegí la materia destino"); return; }
    start(async () => {
      const res = await importFromNotionAction({ subjectId, parcial: Number(parcial) });
      if (res.error) { toast.error(res.error); return; }
      toast.success(`${res.imported} bloque(s) importados de Notion y agendados 📅`);
      router.refresh();
    });
  };

  const disconnect = () => start(async () => {
    await disconnectNotionAction();
    setConnected(false); setDbId("");
    toast.success("Notion desconectado");
    router.refresh();
  });

  const getUrl = () => start(async () => {
    const res = await getIcsUrlAction();
    if (res.error) { toast.error(res.error); return; }
    if (res.success && res.url) setIcsUrl(res.url);
  });

  const copy = () => { if (icsUrl) { navigator.clipboard.writeText(icsUrl); toast.success("URL copiada"); } };

  return (
    <div className="space-y-3">
      {/* NOTION → ESTUDIO */}
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Database size={15} className="text-primary" /> Importar desde Notion</p>
        {!connected ? (
          <>
            <p className="text-[11px] text-muted -mt-1">
              1) Creá una integración interna en notion.so/my-integrations y copiá su token. 2) Compartí tu base con esa integración. 3) Pegá el token y el link de la base.
            </p>
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de integración (secret_… / ntn_…)" className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground" />
            <input value={dbId} onChange={(e) => setDbId(e.target.value)} placeholder="URL o ID de la base de datos de Notion" className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground" />
            <button onClick={connect} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Conectar
            </button>
          </>
        ) : (
          <>
            <p className="text-[11px] text-emerald-500 -mt-1 flex items-center gap-1"><Check size={12} /> Notion conectado. Elegí a qué materia/parcial importar las filas.</p>
            <div className="grid grid-cols-2 gap-2">
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground">
                <option value="">Materia destino…</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </select>
              <select value={parcial} onChange={(e) => setParcial(e.target.value)} className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground">
                {[1, 2, 3, 4].map((p) => <option key={p} value={p}>Parcial {p}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={importNow} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Importar filas
              </button>
              <button onClick={disconnect} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-danger"><X size={14} /> Desconectar</button>
            </div>
          </>
        )}
      </div>

      {/* GOOGLE CALENDAR → ESTUDIO */}
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><CalendarDays size={15} className="text-primary" /> Traer tu Google / Notion Calendar</p>
        {!gcalConnected ? (
          <>
            <p className="text-[11px] text-muted -mt-1">
              En Google Calendar → Configuración → tu calendario → “Integrar calendario” → copiá la <b>Dirección secreta en formato iCal</b> y pegala acá. (Tu Notion Calendar usa Google por detrás.)
            </p>
            <input value={gcalUrl} onChange={(e) => setGcalUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground" />
            <button onClick={connectGcal} disabled={gbusy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {gbusy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Conectar calendario
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-emerald-500 flex items-center gap-1"><Check size={12} /> Calendario conectado</p>
              <button onClick={disconnectGcal} disabled={gbusy} className="text-[11px] text-muted hover:text-danger inline-flex items-center gap-1"><X size={12} /> Desconectar</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={loadEvents} disabled={gbusy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:border-primary/50 disabled:opacity-50">
                {gbusy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Ver próximos eventos
              </button>
              <button onClick={importExams} disabled={gbusy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Download size={14} /> Importar parciales
              </button>
            </div>
            {events && (
              events.length === 0 ? (
                <p className="text-[11px] text-muted">No hay eventos en los próximos días.</p>
              ) : (
                <div className="rounded-lg border border-border divide-y divide-border max-h-56 overflow-y-auto">
                  {events.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="text-[11px] font-semibold text-primary w-16 shrink-0">
                        {new Date(e.start).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                      </span>
                      <span className="text-xs text-foreground truncate flex-1">{e.title}</span>
                      {!e.allDay && <span className="text-[10px] text-muted shrink-0">{new Date(e.start).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                  ))}
                </div>
              )
            )}
            <p className="text-[11px] text-muted">“Importar parciales” busca eventos tipo <i>parcial/final/entrega</i> y los agenda en la materia que coincida con la sigla del título.</p>
          </>
        )}
      </div>

      {/* ESTUDIO → CALENDARIO */}
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Download size={15} className="text-primary" /> Suscribir tu calendario</p>
        <p className="text-[11px] text-muted -mt-1">Generá una URL para ver tus repasos y parciales en Notion Calendar, Google Calendar u Outlook (se actualiza solo).</p>
        {!icsUrl ? (
          <button onClick={getUrl} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Obtener URL del calendario
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input readOnly value={icsUrl} className="flex-1 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-[11px] text-foreground" onFocus={(e) => e.currentTarget.select()} />
            <button onClick={copy} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"><Copy size={14} /></button>
          </div>
        )}
        {icsUrl && <p className="text-[11px] text-muted">Pegala en tu app de calendario como “Suscribirse a un calendario por URL”. Es un enlace secreto: no lo compartas.</p>}
      </div>
    </div>
  );
}
