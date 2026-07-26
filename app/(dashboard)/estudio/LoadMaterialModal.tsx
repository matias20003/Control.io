"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { X, Loader2, FileText, Sparkles, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createStudyUploadUrlAction, loadTopicMaterialAction } from "@/app/actions/study-system";
import type { BlockDTO } from "@/lib/db/study-system";

export function LoadMaterialModal({ block, onClose, onDone }: { block: BlockDTO; onClose: () => void; onDone: (summary: string) => void }) {
  const [text, setText] = useState(block.summary ?? "");
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const pendingFiles = useRef<File[]>([]);

  const run = () => {
    if (!text.trim() && pendingFiles.current.length === 0) { toast.error("Pegá el apunte o subí una foto/PDF"); return; }
    setBusy(true);
    start(async () => {
      try {
        const uploaded: { path: string; type: string }[] = [];
        if (pendingFiles.current.length) {
          const supabase = createClient();
          for (const f of pendingFiles.current) {
            const su = await createStudyUploadUrlAction();
            if (!su.success || !su.path) throw new Error(su.error ?? "No pude preparar la subida");
            const { error } = await supabase.storage.from(su.bucket).uploadToSignedUrl(su.path, su.token, f);
            if (error) throw new Error("No pude subir el archivo");
            uploaded.push({ path: su.path, type: f.type });
          }
        }
        const res = await loadTopicMaterialAction({ blockId: block.id, text: text.trim() || undefined, files: uploaded.length ? uploaded : undefined });
        if (res.error) { toast.error(res.error); return; }
        if (res.success && res.summary) { onDone(res.summary); toast.success("Apunte guardado — ya podés generar sus preguntas 🧠"); onClose(); }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-muted">{block.code} · {block.subjectCode}</p>
            <h3 className="text-base font-bold text-foreground">Cargar apunte: {block.topic}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-foreground"><X size={18} /></button>
        </div>
        <p className="text-[11px] text-muted -mt-1">Pegá el apunte o subí una <b>foto/PDF</b>. La IA lo resume (solo lo que está en el material) y lo guarda en este tema. De ahí salen las flashcards.</p>

        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Pegá acá el contenido del tema…" className="w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground resize-y" />

        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple className="hidden"
            onChange={(e) => { const fs = Array.from(e.target.files ?? []); pendingFiles.current = fs; setFileNames(fs.map((f) => f.name)); }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-primary/50 disabled:opacity-50">
            <FileText size={15} /> Foto o PDF
          </button>
          <button onClick={run} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {busy ? "Procesando…" : "Resumir y guardar"}
          </button>
        </div>
        {fileNames.length > 0 && <p className="text-[11px] text-emerald-500 flex items-center gap-1"><Check size={12} /> {fileNames.join(", ")}</p>}
        <p className="text-[11px] text-muted">Apuntes a mano: subí una <b>foto</b> nítida (leo la letra).</p>
      </div>
    </div>
  );
}
