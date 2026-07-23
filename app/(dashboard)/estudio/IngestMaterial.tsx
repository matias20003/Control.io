"use client";

import { useState, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, FileText, Wand2, Check, X, BookOpen, FastForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createBlocksBulkAction, createStudyUploadUrlAction, analyzeUploadedAction, cleanupStudyUploadsAction } from "@/app/actions/study-system";
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
  const [progress, setProgress] = useState("");
  const [proposed, setProposed] = useState<Proposed[] | null>(null);
  const [unit, setUnit] = useState("");
  const [include, setInclude] = useState<boolean[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [creating, startCreate] = useTransition();
  const [notebookMode, setNotebookMode] = useState(false);
  const [fromPage, setFromPage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]); // cola de PDF elegidos, sin procesar
  const [notebookInfo, setNotebookInfo] = useState<NotebookInfo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null); // PDF en curso, para "procesar siguientes tramos"
  const queue = useRef<File[]>([]); // PDF que faltan procesar (para 'analizar varios en fila')

  const subjectCode = subjects.find((s) => s.id === subjectId)?.code;

  const analyze = async (files?: File[], opts?: { notebook?: boolean; skip?: boolean; continueFrom?: number; startPage?: number }) => {
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
        fromPage: opts?.continueFrom ?? opts?.startPage ?? (useNotebook && !opts?.skip && files && fromPage.trim() ? Number(fromPage) : undefined),
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

  /** Lee un PDF ENTERO: por dentro va por tandas de 6 hojas (sin colgar el
   *  server) pero acumula todo y recién al final te muestra todos los bloques. */
  const analyzeWholePdf = async (file: File, advancePointer: boolean, startFrom?: number) => {
    if (!subjectId) { toast.error("Elegí la materia primero"); return; }
    lastFile.current = file;
    setAnalyzing(true);
    setProgress("Subiendo el PDF…");
    let path: string | null = null;
    try {
      const supabase = createClient();
      const su = await createStudyUploadUrlAction();
      if (!su.success || !su.path) throw new Error(su.error ?? "No pude preparar la subida");
      const up = await supabase.storage.from(su.bucket).uploadToSignedUrl(su.path, su.token, file);
      if (up.error) throw new Error("No pude subir el archivo (¿muy pesado o sin conexión?)");
      path = su.path;
      const type = file.type;

      const all: Proposed[] = [];
      let unitName = "";
      let total = 0;
      let cursor = startFrom ?? (fromPage.trim() ? Number(fromPage) : 1);
      let guard = 0;
      while (guard < 80) {
        setProgress(total ? `Leyendo hojas… ${Math.min(cursor - 1, total)}/${total} · ${all.length} bloques` : "Leyendo el PDF…");
        const data = (await analyzeUploadedAction({
          files: [{ path, type }], subjectId, hintSubject: subjectCode,
          notebook: true, fromPage: cursor, keep: true,
        })) as { error?: string; unit?: string; blocks?: Proposed[]; notebook?: { to?: number; remaining?: number; total?: number; noNew?: boolean } };
        if (data.error) throw new Error(data.error);
        if (data.notebook?.noNew) break;
        all.push(...(data.blocks ?? []));
        if (data.unit && !unitName) unitName = data.unit;
        total = data.notebook?.total ?? total;
        const to = data.notebook?.to ?? cursor + 5;
        if ((data.notebook?.remaining ?? 0) > 0) { cursor = to + 1; guard++; } else break;
      }
      if (!all.length) { toast.error("No pude leer el PDF (¿hojas en blanco o ilegibles?)"); return; }
      setProposed(all);
      setUnit(unitName);
      setInclude(all.map(() => true));
      setNotebookInfo({ to: total, remaining: 0, subjectId, manual: !advancePointer });
      toast.success(`Listo: ${all.length} bloques de todo el PDF. Revisalos y creá.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      if (path) cleanupStudyUploadsAction([path]).catch(() => {});
      setAnalyzing(false);
      setProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const create = () => {
    if (!proposed) return;
    const chosen = proposed.filter((_, i) => include[i]);
    if (chosen.length === 0) { toast.error("Elegí al menos un bloque"); return; }
    startCreate(async () => {
      const payload = chosen.map((b) => ({
        topic: b.topic, unit: b.unit ?? (unit || null), summary: b.summary || null,
        prerequisites: b.prerequisites ?? null, difficulty: b.difficulty, importance: b.importance, estMinutes: b.estMinutes,
      }));
      // La action acepta hasta 20 por llamada: si hay más, creamos en tandas.
      const batches: (typeof payload)[] = [];
      for (let i = 0; i < payload.length; i += 20) batches.push(payload.slice(i, i + 20));
      const created: BlockDTO[] = [];
      for (let bi = 0; bi < batches.length; bi++) {
        const isLast = bi === batches.length - 1;
        const res = await createBlocksBulkAction({
          subjectId, parcial: Number(parcial), blocks: batches[bi],
          ...(isLast && notebookInfo && !notebookInfo.manual ? { notebookTo: notebookInfo.to } : {}),
        });
        if (res.error) { toast.error(res.error); return; }
        if (res.success && res.created) created.push(...res.created);
      }
      onCreated(created);
      setProposed(null); setText(""); setInclude([]); setUnit(""); setNotebookInfo(null);
      toast.success(`${created.length} bloque(s) creados y repartidos 📅`);
      // Si hay más PDF en la cola, paso al siguiente (entero, desde la página 1).
      queue.current = queue.current.slice(1);
      setPendingFiles([...queue.current]);
      const next = queue.current[0];
      if (next) { toast.message(`Siguiente PDF: ${next.name} (${queue.current.length} en cola)`); analyzeWholePdf(next, false, 1); }
      else lastFile.current = null;
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
            <input ref={fileRef} type="file" accept={notebookMode ? "application/pdf" : "application/pdf,image/*"} multiple className="hidden"
              onChange={(e) => {
                const fs = Array.from(e.target.files ?? []);
                if (!fs.length) return;
                // En modo cuaderno NO procesamos al elegir: encolamos y esperamos
                // a que pongas la página y toques "Analizar". Podés elegir VARIOS PDF.
                if (notebookMode) { queue.current = fs; setPendingFiles(fs); lastFile.current = fs[0]; }
                else analyze(fs);
              }} />
            <button onClick={() => fileRef.current?.click()} disabled={analyzing} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-primary/50 disabled:opacity-50">
              <FileText size={15} /> {notebookMode ? (pendingFiles.length ? "Cambiar PDF(s)" : "Elegir PDF(s)") : "PDF o fotos"}
            </button>
            {!notebookMode && (
              <button onClick={() => analyze()} disabled={analyzing} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {analyzing ? "Analizando…" : "Dividir en bloques"}
              </button>
            )}
            {notebookMode && pendingFiles.length > 0 && (
              <>
                <button onClick={() => analyzeWholePdf(pendingFiles[0], pendingFiles.length === 1, pendingFiles.length > 1 ? 1 : undefined)} disabled={analyzing} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {analyzing ? "Analizando…" : pendingFiles.length > 1 ? `Analizar ${pendingFiles.length} PDF enteros` : `Analizar PDF entero ${fromPage.trim() ? `(desde pág. ${fromPage})` : ""}`}
                </button>
                {pendingFiles.length === 1 && (
                  <button onClick={() => analyze(undefined, { notebook: true, skip: true })} disabled={analyzing} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50" title="Marca todo el PDF como visto sin leerlo">
                    <FastForward size={14} /> Marcar como visto
                  </button>
                )}
              </>
            )}
          </div>
          {analyzing && progress && <p className="text-[11px] text-primary flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> {progress}</p>}
          {notebookMode && !analyzing && pendingFiles.length === 1 && <p className="text-[11px] text-emerald-500">📄 {pendingFiles[0].name} — tocá <b>Analizar PDF entero</b> (lee todas las hojas y te muestra todo junto al final).</p>}
          {notebookMode && !analyzing && pendingFiles.length > 1 && <p className="text-[11px] text-emerald-500">📚 {pendingFiles.length} PDF en cola. Leo cada uno <b>entero</b> y te muestro sus bloques; confirmás y paso al siguiente.</p>}
          {notebookMode && !analyzing && pendingFiles.length === 0 && <p className="text-[11px] text-muted">1) Elegí el/los PDF (podés varios). 2) Opcional: desde qué hoja. 3) <b>Analizar PDF entero</b>: lee todo solo (por dentro va por tandas) y al final te muestra todos los bloques juntos.</p>}
        </>
      )}

      {proposed && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">{unit && <>Unidad: <b className="text-foreground">{unit}</b> · </>}{include.filter(Boolean).length}/{proposed.length} seleccionados{notebookInfo && notebookInfo.remaining > 0 && <> · <span className="text-primary">quedan {notebookInfo.remaining} hojas (sigue solo al crear)</span></>}</p>
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
