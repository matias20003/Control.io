"use client";

import { Pencil, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildSubjectColors } from "./colors";
import type { BlockDTO, SubjectDTO } from "@/lib/db/study-system";

const MAST: Record<string, { c: string; l: string }> = {
  ROJO: { c: "#ef4444", l: "Rojo" },
  AMARILLO: { c: "#f59e0b", l: "Amarillo" },
  VERDE: { c: "#10b981", l: "Verde" },
  CONSOLIDADO: { c: "#0ea5e9", l: "Consolidado" },
};
const STAGE: Record<string, string> = {
  "D0": "Estudio inicial", "D+1": "Repaso 1", "D+3": "Repaso 2", "D+7": "Repaso 3",
  "D+16": "Repaso 4", "MANT_SEM": "Mantenimiento", "MANT_QUIN": "Mantenimiento",
};

function dayDiff(iso: string | null, startToday: Date): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((dd.getTime() - startToday.getTime()) / 86_400_000);
}
function colLabel(diff: number, base: Date): string {
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  const d = new Date(base.getTime() + diff * 86_400_000);
  return d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" });
}

export function StudyKanban({
  blocks, subjects, onCard, onEdit,
}: {
  blocks: BlockDTO[];
  subjects: SubjectDTO[];
  onCard: (b: BlockDTO) => void;
  onEdit: (b: BlockDTO) => void;
}) {
  const colors = buildSubjectColors(subjects);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const active = blocks.filter((b) => b.status === "ACTIVO" && b.nextReviewDate);
  const overdue: BlockDTO[] = [];
  const later: BlockDTO[] = [];
  const byDiff = new Map<number, BlockDTO[]>();
  for (const b of active) {
    const diff = dayDiff(b.nextReviewDate, startToday);
    if (diff == null) continue;
    if (diff < 0) overdue.push(b);
    else if (diff <= 9) { const a = byDiff.get(diff) ?? []; a.push(b); byDiff.set(diff, a); }
    else later.push(b);
  }

  type Col = { key: string; label: string; danger?: boolean; list: BlockDTO[] };
  const cols: Col[] = [];
  if (overdue.length) cols.push({ key: "overdue", label: `Atrasados`, danger: true, list: overdue });
  for (let diff = 0; diff <= 9; diff++) {
    const list = byDiff.get(diff) ?? [];
    if (diff <= 1 || list.length) cols.push({ key: `d${diff}`, label: colLabel(diff, startToday), list });
  }
  if (later.length) cols.push({ key: "later", label: "Más adelante", list: later });

  const Card = ({ b }: { b: BlockDTO }) => {
    const m = MAST[b.masteryLevel] ?? MAST.ROJO;
    const col = colors.get(b.subjectId) ?? "#94a3b8";
    return (
      <div className="rounded-lg border border-border bg-surface p-2.5 space-y-1.5" style={{ borderLeft: `3px solid ${col}` }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-muted truncate" title={b.code}>{b.code}</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold shrink-0" style={{ color: m.c }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.c }} /> {m.l}
          </span>
        </div>
        <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2" title={b.topic}>{b.topic}</p>
        <div className="flex items-center gap-1.5 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: col }} />{b.subjectCode}</span>
          <span>· {STAGE[b.reviewStage] ?? b.reviewStage}</span>
          <span>· ~{b.reviewDuration}′</span>
        </div>
        {b.lastError && (
          <p className="text-[10px] text-amber-500 flex items-center gap-1"><AlertCircle size={10} className="shrink-0" /><span className="truncate">{b.lastError}</span></p>
        )}
        <div className="flex items-center gap-1.5 pt-0.5">
          <button onClick={() => onCard(b)} className="flex-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20">Cerrar</button>
          <button onClick={() => onEdit(b)} className="rounded-md border border-border px-1.5 py-1 text-muted hover:text-foreground" aria-label="Editar"><Pencil size={12} /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Leyenda de colores por materia */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {subjects.filter((s) => blocks.some((b) => b.subjectId === s.id)).map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors.get(s.id) }} /> {s.code}
          </span>
        ))}
      </div>

      {cols.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">No hay repasos programados.</div>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
          {cols.map((c) => (
            <div key={c.key} className="w-[190px] shrink-0">
              <div className={cn("flex items-center justify-between rounded-t-lg px-2.5 py-1.5 text-[11px] font-semibold", c.danger ? "bg-danger/15 text-danger" : "bg-surface-2/50 text-foreground")}>
                <span className="capitalize">{c.label}</span>
                <span className="text-muted">{c.list.length}</span>
              </div>
              <div className="space-y-1.5 rounded-b-lg border border-t-0 border-border bg-surface-2/20 p-1.5 min-h-[60px]">
                {c.list.length === 0 ? (
                  <p className="text-[10px] text-muted text-center py-3">—</p>
                ) : (
                  c.list.map((b) => <Card key={b.id} b={b} />)
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
