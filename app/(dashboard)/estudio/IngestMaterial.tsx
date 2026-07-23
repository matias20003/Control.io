"use client";

import { useState, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, FileText, Wand2, Check, X, BookOpen, FastForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createBlocksBulkAction, createStudyUploadUrlAction, analyzeUploadedAction } from "@/app/actions/study-system";
import type { SubjectDTO, BlockDTO } from "@/lib/db/study-system";

type Proposed = {
  topic: string; unit: string | null; summary: string; prerequisites: string | null;
  difficulty: number; importance: number; estMinutes: number; external: boolean;
};
type NotebookInfo = { to: number; remaining: number; subjectId: string; manual: boolean };

const IMP = ["", "Baja", "Media", "Alta", "Muy alta"];
const DIF = ["", "Fácil", "Media", "Difícil", "Muy difícil"];

export function IngestMaterial({
  subjects, onCreated,
}: {
  subjects: SubjectDTO[];
  onCreated: (blocks: BlockDTO[]) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [parcial, setParcial] = useState("1");
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [proposed, setProposed] = useState<Proposed[] | null>(null);
  const [unit, setUnit] = useState("");
  const [include, setInclude] = useState<boolean[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [creating, startCreate] = useTransition();
  const [notebookMode, setNotebookMode] = useState(false);
  const [fromPage, setFromPage] = useState("");
  const [notebookInfo, setNotebookInfo] = useState<NotebookInfo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null); // el cuaderno, para "procesar siguientes"

  const subjectCode = subjects.find((s) => s.id === subjectId)?.code;

  const analyze = async (files?: File[], opts?: { notebook?: boolean; skip?: boolean; continueFrom?: number }) => {
    if (!subjectId) { toast.error("Elegí la materia primero"); return; }
    const useNotebook = opts?.notebook ?? notebookMode;
    if ((!files || files.length === 0) && !opts?.skip && text.trim().length < 40) { toast.error("Pegá el apunte o subí un PDF/foto"); return; }
    if (useNotebook && files && files[0]) lastFile.current = files[0];
    setAnalyzing(true);
    try {
      const send = files ?? (useNotebook && lastFile.current ? [lastFile.current] : []);
      // Subimos cada archivo directo a Storage (evita el límite de 4.5MB de Vercel).
      const uploaded: { path: string; type: string }[] = [];
      if (send.length) {
        const supabase = createClient();
        for (const f of send) {
          const su = await createStudyUploadUrlAction();
          if (!su.success || !su.path) throw new Error(su.error ?? "No pude preparar la subida");
          const { error } = await supabase.storage.from(su.bucket).uploadToSignedUrl(su.path, su.token, f);
          if (error) throw new Error("No pude subir el archivo (¿muy pesado o sin conexión?)");
          uploaded.push({ path: su.path, type: f.type });
        }
      }

      const data = (await analyzeUploadedAction({
        files: uploaded.length ? uploaded : undefined,
        text: !useNotebook && text.trim() ? text.trim() : undefined,
        subjectId,
        hintSubject: subjectCode,
        notebook: useNotebook || undefined,
        fromPage: opts?.continueFrom ?? (useNotebook && !opts?.skip && files && fromPage.trim() ? Number(fromPage) : undefined),
        skip: opts?.skip || undefined,
      })) as {
        error?: string; success?: boolean; unit?: string; blocks?: Proposed[];
        notebook?: { skipped?: boolean; noNew?: boolean; to?: number; remaining?: number; subjectId?: string; total?: number; manual?: boolean };
      };
      if (data.error) throw new Error(data.error);

      // Respuestas del modo cuaderno
      if (data.notebook?.skipped) { toast.success(`Listo — arranco a leer desde acá (${data.notebook.total} hojas marcadas como vistas).`); return; }
      if (data.notebook?.noNew) { toast.success("No hay hojas nuevas en el cuaderno 👌"); return; }

      const blocks: Proposed[] = data.blocks ?? [];
      if (!blocks.length) { toast.error("No pude dividir el material."); return; }
      setProposed(blocks);
      setUnit(data.unit ?? "");
      setInclude(blocks.map(() => true));
      setNotebookInfo(
        data.notebook && typeof data.notebook.to === "number"
          ? { to: data.notebook.to, remaining: data.notebook.remaining ?? 0, subjectId: data.notebook.subjectId ?? subjectId, manual: !!data.notebook.manual }
          : null
      );
      const extra = data.notebook ? ` (hojas nuevas; quedan ${data.notebook.remaining ?? 0})` : "";
      toast.success(`La IA propuso ${blocks.length} bloque(s)${extra}. Revisalos y creá.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const create = () => {
    if (!proposed) return;
    const chosen = proposed.filter((_, i) => include[i]);
    if (chosen.length === 0) { toast.error("Elegí al menos un bloque"); return; }
    startCreate(async () => {
      const res = await createBlocksBulkAction({
        subjectId, parcial: Number(parcial),
        blocks: chosen.map((b) => ({
          topic: b.topic, unit: b.unit ?? (unit || null), summary: b.summary || null,
          prerequisites: b.prerequisites ?? null, difficulty: b.difficulty, importance: b.importance, estMinutes: b.estMinutes,
        })),
        // Solo avanzamos el puntero del cuaderno en modo AUTO (no en rango manual).
        ...(notebookInfo && !notebookInfo.manual ? { notebookTo: notebookInfo.to } : {}),
      });
      if (res.error) { toast.error(res.error); return; }
      if (res.success && res.created) {
        onCreated(res.created);
        const info = notebookInfo;
        setProposed(null); setText(""); setInclude([]); setUnit("");
        toast.success(`${res.created.length} bloque(s) creados y repartidos 📅`);
        // Si quedan hojas, procesamos el próximo tramo. En manual seguimos por
        // rango explícito (no toca el puntero); en auto, por el puntero.
        if (info && info.remaining > 0 && lastFile.current) {
          toast.message(`Quedan ${info.remaining} hojas — sigo con el próximo tramo…`);
          setNotebookInfo(null);
          analyze(undefined, info.manual ? { notebook: true, continueFrom: info.to + 1 } : { notebook: true });
        } else {
          setNotebookInfo(null);
        }
      }
    });
  };

  const toggle = (i: number) => setInclude((prev) => prev.map((v, j) => (j === i ? !v : v)));

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.03] p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Wand2 size={16} className="text-primary" />
        <p className="text-sm font-semibold text-foreground">Cargar material — la IA lo divide en bloques</p>
      </div>
      <p className="text-[11px] text-muted -mt-1">Pegá un apunte/clase/guía, o subí un PDF / <b>varias imágenes juntas</b> (seleccioná todas las hojas de la clase con Ctrl+clic o Ctrl+A). Te lo parto en bloques y los reparto en el calendario sin sobrecargar días.</p>

      <div className="grid grid-cols-2 gap-2">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
          <option value="">Materia…</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>
        <select value={parcial} onChange={(e) => setParcial(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
          {[1, 2, 3, 4].map((p) => <option key={p} value={p}>Parcial {p}</option>)}
        </select>
      </div>

      {/* Modo cuaderno */}
      <label className="flex items-start gap-2 rounded-lg border border-border bg-surface/60 p-2.5 cursor-pointer">
        <input type="checkbox" checked={notebookMode} onChange={(e) => setNotebookMode(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
        <span className="text-[11px] text-foreground">
          <b className="flex items-center gap-1"><BookOpen size={12} /> PDF manuscrito o anotado (lo leo como imagen)</b>
          <span className="text-muted">Para apuntes a mano (Samsung Notes) o PDF de la profe con TUS anotaciones encima: lo leo como imagen y capto lo impreso y lo escrito a mano. Decile desde qué hoja (ej. 15) o dejá “auto” para seguir tu cuaderno desde donde quedó.</span>
        </span>
      </label>
      {notebookMode && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2">
          <span className="text-[11px] text-muted">Analizar desde la página</span>
          <input type="number" min="1" inputMode="numeric" value={fromPage} onChange={(e) => setFromPage(e.target.value)} placeholder="auto" className="w-20 rounded-lg border border-border bg-surface-2/40 px-2 py-1 text-sm text-foreground text-center" />
          <span className="text-[11px] text-muted">hasta la última</span>
        </div>
      )}

      {!proposed && (
        <>
          {!notebookMode && (
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Pegá el contenido del apunte/clase…" rows={3} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground resize-y" />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept={notebookMode ? "application/pdf" : "application/pdf,image/*"} multiple={!notebookMode} className="hidden" onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) analyze(fs); }} />
            <button onClick={() => fileRef.current?.click()} disabled={analyzing} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-primary/50 disabled:opacity-50">
              <FileText size={15} /> {notebookMode ? "Subir cuaderno (PDF)" : "PDF o fotos"}
            </button>
            {notebookMode ? (
              <button onClick={() => { if (!fileRef.current?.files?.length && !lastFile.current) { toast.error("Subí el PDF del cuaderno primero"); return; } analyze(undefined, { notebook: true, skip: true }); }} disabled={analyzing} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50" title="Marca todo lo actual como visto y arranca a leer desde las próximas hojas">
                <FastForward size={14} /> Empezar desde acá
              </button>
            ) : (
              <button onClick={() => analyze()} disabled={analyzing} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {analyzing ? "Analizando…" : "Dividir en bloques"}
              </button>
            )}
          </div>
          {notebookMode && <p className="text-[11px] text-muted">Poné el número de hoja donde empezó la clase de hoy (ej. 15) y leo de ahí a la última. Lo hago de a 6 hojas y sigo solo. Si dejás “auto”, continúa desde donde quedó. <b>“Empezar desde acá”</b> marca el PDF actual como visto sin leerlo.</p>}
        </>
      )}

      {proposed && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">{unit && <>Unidad: <b className="text-foreground">{unit}</b> · </>}{include.filter(Boolean).length}/{proposed.length} seleccionados{notebookInfo && <> · <span className="text-primary">cuaderno: quedan {notebookInfo.remaining}</span></>}</p>
            <button onClick={() => { setProposed(null); setInclude([]); setNotebookInfo(null); }} className="text-[11px] text-muted hover:text-foreground inline-flex items-center gap-1"><X size={12} /> Descartar</button>
          </div>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {proposed.map((b, i) => (
              <div key={i} className={cn("rounded-xl border p-2.5", include[i] ? "border-primary/40 bg-surface" : "border-border bg-surface/40 opacity-60")}>
                <div className="flex items-start gap-2">
                  <button onClick={() => toggle(i)} className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2", include[i] ? "border-primary bg-primary text-white" : "border-border")}>
                    {include[i] && <Check size={12} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => setExpanded(expanded === i ? null : i)} className="text-left w-full">
                      <p className="text-sm font-medium text-foreground">{b.topic} {b.external && <span className="text-[10px] text-amber-500">(aclaración externa)</span>}</p>
                      <p className="text-[11px] text-muted">~{b.estMinutes}′ · dif. {DIF[b.difficulty]} · imp. {IMP[b.importance]}</p>
                    </button>
                    {expanded === i && (
                      <div className="mt-1.5 rounded-lg bg-surface-2/40 p-2 text-[11px] text-foreground/80 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {b.summary || "(sin resumen)"}
                        {b.prerequisites && <p className="mt-1 text-muted">Prerequisitos: {b.prerequisites}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={create} disabled={creating} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Crear {include.filter(Boolean).length} bloque(s) y agendar
          </button>
        </div>
      )}
    </div>
  );
}
