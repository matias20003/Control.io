"use client";

/**
 * La carrera: qué debo, qué puedo cursar y qué final tengo colgado.
 *
 * Es la pantalla que ninguna app internacional puede tener, porque su modelo no
 * contempla el estado que acá define todo: cursada aprobada con final
 * pendiente. Afuera una materia se aprueba y se termina; acá puede quedar
 * colgada meses o años.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, GraduationCap, Lock, Pencil, Plus, Trash2, Unlock } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  addPrerequisiteAction, deleteSubjectAction, removePrerequisiteAction, saveSubjectAction,
} from "@/app/actions/study-career";
import type { CareerData } from "@/lib/db/study-career";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CURSANDO: "Cursando",
  CURSADA_APROBADA: "Cursada aprobada · final pendiente",
  APROBADA: "Aprobada",
  LIBRE: "Libre",
  ABANDONADA: "Abandonada",
};

const STATUS_TONE: Record<string, string> = {
  PENDIENTE: "border-border text-muted",
  CURSANDO: "border-primary/40 bg-primary/10 text-primary",
  CURSADA_APROBADA: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  APROBADA: "border-success/40 bg-success/10 text-success",
  LIBRE: "border-danger/40 bg-danger/10 text-danger",
  ABANDONADA: "border-border text-muted line-through",
};

const KIND_LABEL: Record<string, string> = {
  CURSAR_NECESITA_CURSADA: "para cursarla necesito la cursada de",
  CURSAR_NECESITA_APROBADA: "para cursarla necesito aprobada",
  RENDIR_NECESITA_APROBADA: "para rendir el final necesito aprobada",
};

type Subject = CareerData["subjects"][number];

function Stat({ value, label, tone }: { value: string | number; label: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className={`text-2xl font-bold tabular-nums ${tone ?? "text-foreground"}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function SubjectForm({ subject, onDone }: { subject?: Subject; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(subject?.name ?? "");
  const [code, setCode] = useState(subject?.code ?? "");
  const [status, setStatus] = useState(subject?.status ?? "PENDIENTE");
  const [planYear, setPlanYear] = useState(subject?.planYear ? String(subject.planYear) : "");
  const [cursadaGrade, setCursadaGrade] = useState(subject?.cursadaGrade != null ? String(subject.cursadaGrade) : "");
  const [finalGrade, setFinalGrade] = useState(subject?.finalGrade != null ? String(subject.finalGrade) : "");
  const [promoted, setPromoted] = useState(subject?.promoted ?? false);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const result = await saveSubjectAction({
      id: subject?.id,
      name, code,
      planYear: planYear ? Number(planYear) : null,
      status: status as "PENDIENTE",
      cursadaGrade: cursadaGrade ? Number(cursadaGrade) : null,
      finalGrade: finalGrade ? Number(finalGrade) : null,
      promoted,
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success(subject ? "Materia actualizada" : "Materia agregada");
    onDone();
    router.refresh();
  });

  const input = "min-h-11 rounded-xl border border-border bg-background px-3 text-sm";

  return (
    <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-3">
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Análisis Matemático II"
          aria-label="Nombre" className={`${input} min-w-52 flex-1`} />
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="AM2" maxLength={20}
          aria-label="Código" className={`${input} w-24`} />
        <input value={planYear} onChange={(e) => setPlanYear(e.target.value)} placeholder="Año" type="number" min={1} max={9}
          aria-label="Año del plan" className={`${input} w-20`} />
      </div>

      <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado" className={`${input} w-full`}>
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      {(status === "CURSADA_APROBADA" || status === "APROBADA") && (
        <div className="flex flex-wrap items-center gap-2">
          <input value={cursadaGrade} onChange={(e) => setCursadaGrade(e.target.value)} type="number" min={0} max={10} step={0.5}
            placeholder="Nota cursada" aria-label="Nota de cursada" className={`${input} w-36`} />
          {status === "APROBADA" && !promoted && (
            <input value={finalGrade} onChange={(e) => setFinalGrade(e.target.value)} type="number" min={0} max={10} step={0.5}
              placeholder="Nota final" aria-label="Nota del final" className={`${input} w-32`} />
          )}
          {status === "APROBADA" && (
            <label className="inline-flex min-h-11 items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={promoted} onChange={(e) => setPromoted(e.target.checked)} />
              Promocioné
            </label>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="min-h-10 px-3 text-sm text-muted">Cancelar</button>
        <button onClick={save} disabled={pending || !name.trim() || !code.trim()}
          className="min-h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40">
          Guardar
        </button>
      </div>
    </div>
  );
}

export function CarreraClient({ career }: { career: CareerData }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Subject | null>(null);
  const [linking, setLinking] = useState<Subject | null>(null);
  const [pending, start] = useTransition();

  const { subjects, progress, finals, prerequisites } = career;
  const byId = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const canCursar = subjects.filter((s) => s.status === "PENDIENTE" && s.canCursar);
  const cursando = subjects.filter((s) => s.status === "CURSANDO");

  const remove = (subject: Subject) => start(async () => {
    const result = await deleteSubjectAction(subject.id);
    if (result.error) toast.error(result.error);
    else { setRemoving(null); toast.success("Materia borrada"); router.refresh(); }
  });

  const unlink = (id: string) => start(async () => {
    const result = await removePrerequisiteAction(id);
    if (result.error) toast.error(result.error);
    else router.refresh();
  });

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mi carrera</h1>
          <p className="mt-1 text-sm text-muted">Qué debo, qué puedo cursar y qué final me queda colgado.</p>
        </div>
        <button onClick={() => { setAdding(true); setEditing(null); }}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white">
          <Plus size={17} /> Agregar materia
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={`${progress.percent}%`} label={`${progress.approved} de ${progress.total} aprobadas`} tone="text-success" />
        <Stat value={progress.cursadaOnly} label="Finales colgados" tone={progress.cursadaOnly > 0 ? "text-amber-600" : undefined} />
        <Stat value={progress.averageApproved ?? "—"} label="Promedio (sin aplazos)" />
        <Stat value={progress.average ?? "—"} label="Promedio del analítico" />
      </div>

      {adding && <SubjectForm onDone={() => setAdding(false)} />}

      {/* Los finales colgados van arriba: es lo que más se pierde de vista. La
          cursada se aprobó, la materia "se siente" hecha, y el final queda. */}
      {finals.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-600">
            <AlertCircle size={15} /> Finales pendientes
          </h2>
          <ul className="space-y-2">
            {finals.map(({ subject, canRendir, blockers }) => (
              <li key={subject.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
                <span className="font-medium text-foreground">{subject.name}</span>
                <span className="text-xs text-muted">{subject.code}</span>
                {canRendir ? (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                    <Unlock size={11} /> Podés rendirlo
                  </span>
                ) : (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted">
                    <Lock size={11} /> Antes: {blockers.map((b) => b.requiredName).join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* La pregunta de cada inscripción. */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Puedo cursar el próximo cuatrimestre</h2>
        {canCursar.length === 0 ? (
          <p className="text-sm text-muted">
            {subjects.length === 0
              ? "Cargá tus materias y sus correlativas para que aparezca acá."
              : "Nada desbloqueado por ahora. Aprobá una correlativa y esto se llena solo."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {canCursar.map((subject) => (
              <span key={subject.id} className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1.5 text-sm text-success">
                <Check size={13} /> {subject.name}
                {subject.planYear && <span className="opacity-70">· {subject.planYear}º</span>}
              </span>
            ))}
          </div>
        )}
        {cursando.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Cursando ahora: {cursando.map((s) => s.name).join(" · ")}
          </p>
        )}
      </section>

      {/* Todas las materias, con sus correlativas. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Todas las materias</h2>
        {subjects.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border bg-surface/40 px-4 py-8 text-center text-sm text-muted">
            Todavía no cargaste ninguna materia.
          </p>
        )}
        {subjects.map((subject) => {
          const own = prerequisites.filter((rule) => rule.subjectId === subject.id);
          return (
            <article key={subject.id} className="rounded-2xl border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <GraduationCap size={15} className="shrink-0 text-muted" />
                <span className="font-medium text-foreground">{subject.name}</span>
                <span className="text-xs text-muted">{subject.code}</span>
                {subject.planYear && <span className="text-xs text-muted">{subject.planYear}º año</span>}
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS_TONE[subject.status] ?? ""}`}>
                  {STATUS_LABEL[subject.status] ?? subject.status}
                </span>
                {!subject.canCursar && subject.status === "PENDIENTE" && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <Lock size={10} /> falta {subject.blockers.map((b) => b.requiredName).join(", ")}
                  </span>
                )}
                <div className="ml-auto flex shrink-0 gap-0.5">
                  <button aria-label={`Correlativas de ${subject.name}`} title="Correlativas"
                    onClick={() => setLinking(linking?.id === subject.id ? null : subject)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
                    <Lock size={13} />
                  </button>
                  <button aria-label={`Editar ${subject.name}`} title="Editar"
                    onClick={() => { setEditing(editing === subject.id ? null : subject.id); setAdding(false); }}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
                    <Pencil size={13} />
                  </button>
                  <button aria-label={`Borrar ${subject.name}`} title="Borrar"
                    onClick={() => setRemoving(subject)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {own.length > 0 && (
                <ul className="mt-2 space-y-1 border-l border-border pl-3">
                  {own.map((rule) => {
                    const required = byId.get(rule.requiredId);
                    return (
                      <li key={rule.id ?? `${rule.requiredId}-${rule.kind}`} className="flex items-center gap-2 text-[11px] text-muted">
                        <span>{KIND_LABEL[rule.kind]} <span className="font-medium text-foreground">{required?.name ?? "—"}</span></span>
                        {rule.id && (
                          <button
                            aria-label="Quitar correlativa"
                            onClick={() => unlink(rule.id!)}
                            disabled={pending}
                            className="text-muted hover:text-danger"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {editing === subject.id && (
                <div className="mt-3"><SubjectForm subject={subject} onDone={() => setEditing(null)} /></div>
              )}

              {linking?.id === subject.id && (
                <AddPrerequisite subject={subject} subjects={subjects} onDone={() => setLinking(null)} />
              )}
            </article>
          );
        })}
      </section>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title={`¿Borrar ${removing?.name}?`}
        description="Se borran también sus correlativas. No se puede deshacer."
        confirmLabel="Borrar"
        isPending={pending}
        onConfirm={() => removing && remove(removing)}
      />
    </main>
  );
}

function AddPrerequisite({ subject, subjects, onDone }: {
  subject: Subject; subjects: Subject[]; onDone: () => void;
}) {
  const router = useRouter();
  const [requiredId, setRequiredId] = useState("");
  const [kind, setKind] = useState<keyof typeof KIND_LABEL>("CURSAR_NECESITA_CURSADA");
  const [pending, start] = useTransition();

  const add = () => start(async () => {
    const result = await addPrerequisiteAction(subject.id, requiredId, kind as "CURSAR_NECESITA_CURSADA");
    if (result.error) { toast.error(result.error); return; }
    toast.success("Correlativa agregada");
    setRequiredId("");
    onDone();
    router.refresh();
  });

  const input = "min-h-11 rounded-xl border border-border bg-background px-3 text-sm";

  return (
    <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3">
      <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Tipo de correlativa" className={`${input} min-w-52 flex-1`}>
        {Object.entries(KIND_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <select value={requiredId} onChange={(e) => setRequiredId(e.target.value)} aria-label="Materia correlativa" className={`${input} min-w-40 flex-1`}>
        <option value="">Elegí la materia…</option>
        {subjects.filter((other) => other.id !== subject.id).map((other) => (
          <option key={other.id} value={other.id}>{other.name}</option>
        ))}
      </select>
      <button onClick={add} disabled={pending || !requiredId}
        className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40">
        Agregar
      </button>
      <button onClick={onDone} className="min-h-11 px-3 text-sm text-muted">Cerrar</button>
    </div>
  );
}
