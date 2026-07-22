"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Link2, Check, X, Download, Copy, RefreshCw, Database } from "lucide-react";
import {
  connectNotionAction, importFromNotionAction, disconnectNotionAction, getIcsUrlAction,
} from "@/app/actions/study-system";
import type { SubjectDTO, BlockDTO } from "@/lib/db/study-system";

export function NotionCalendar({
  subjects, notion, onImported,
}: {
  subjects: SubjectDTO[];
  notion: { connected: boolean; dbId: string | null; hasIcs: boolean };
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
