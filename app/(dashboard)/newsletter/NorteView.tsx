"use client";

import { useState, useTransition } from "react";
import { Check, Compass, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createFrontAction,
  deleteFrontAction,
  markNorthReviewedAction,
  updateFrontAction,
} from "@/app/actions/circle-system";
import type { SerializedFront } from "@/lib/db/circle-north";
import { MAX_FRONTS, suggestTopics } from "@/lib/circle-north";
import { SectionHeading, QuietEmpty } from "./CircleUI";

export function NorteView({
  fronts,
  needsReview,
  onFrontsChange,
}: {
  fronts: SerializedFront[];
  needsReview: boolean;
  onFrontsChange: (next: SerializedFront[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const remove = (front: SerializedFront) => {
    startTransition(async () => {
      const result = await deleteFrontAction(front.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onFrontsChange(fronts.filter((item) => item.id !== front.id));
      toast.success(`"${front.label}" ya no es uno de tus frentes.`);
    });
  };

  const review = () => {
    startTransition(async () => {
      const result = await markNorthReviewedAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Anotado. Nos vemos en tres meses.");
    });
  };

  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="El Norte"
        title="Quién querés ser"
        description="Dos o tres frentes, no más. No es una frase motivacional: es el filtro con el que se elige qué información entra a tu edición y cuál no."
      />

      {needsReview && fronts.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-warning-dim px-5 py-4">
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-warning">
            Hace tres meses o más que no revisás tu Norte. ¿Sigue siendo esto lo
            que querés?
          </p>
          <Button variant="secondary" onClick={review} disabled={isPending}>
            <Check size={16} />
            Sigue igual
          </Button>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface/45">
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-news text-xl text-foreground">Tus frentes</h3>
            <p className="mt-1 text-xs text-muted">
              {fronts.length} de {MAX_FRONTS}
              {fronts.length > 0 && " · el primero pesa más al armar la edición"}
            </p>
          </div>

          {fronts.map((front, index) =>
            editingId === front.id ? (
              <EditFrontRow
                key={front.id}
                front={front}
                onDone={(updated) => {
                  if (updated) {
                    onFrontsChange(
                      fronts.map((item) => (item.id === updated.id ? updated : item)),
                    );
                  }
                  setEditingId(null);
                }}
              />
            ) : (
              <div
                key={front.id}
                className="flex items-start gap-3 border-b border-border px-4 py-4 last:border-b-0"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Compass size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {front.label}
                    {index === 0 && (
                      <span className="ml-2 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        principal
                      </span>
                    )}
                  </p>
                  {front.detail && (
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {front.detail}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">
                    Las noticias se buscan usando toda esta idea, no palabras sueltas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingId(front.id)}
                  aria-label={`Editar ${front.label}`}
                  className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-surface-3"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(front)}
                  disabled={isPending}
                  aria-label={`Sacar ${front.label}`}
                  className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-danger-dim hover:text-danger disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ),
          )}

          {fronts.length === 0 && (
            <QuietEmpty text="Todavía no declaraste tu Norte. Sin esto, la edición se arma con temas sueltos." />
          )}
        </div>

        {fronts.length < MAX_FRONTS ? (
          <AddFrontForm onAdded={(front) => onFrontsChange([...fronts, front])} />
        ) : (
          <div className="rounded-xl border border-border bg-surface/60 p-5">
            <p className="text-sm font-semibold text-foreground">
              Tres frentes es el máximo
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Más frentes es no tener ninguno. Si querés sumar otro, sacá alguno
              de los que ya están.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function AddFrontForm({ onAdded }: { onAdded: (front: SerializedFront) => void }) {
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");
  const [isSaving, startSaving] = useTransition();

  // La intención se muestra antes de guardar para que la persona pueda revisar
  // cómo se interpretará todo lo que escribió.
  const preview = suggestTopics(label, detail);

  const submit = () => {
    const clean = label.trim();
    if (!clean) return;
    startSaving(async () => {
      const result = await createFrontAction({
        label: clean,
        detail: detail.trim() || null,
      });
      if (result.error || !result.front) {
        toast.error(result.error ?? "No pudimos guardar ese frente.");
        return;
      }
      onAdded(result.front);
      setLabel("");
      setDetail("");
      toast.success("Frente agregado.");
    });
  };

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-5">
      <p className="text-sm font-semibold text-foreground">Declarar un frente</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Escribilo como se lo dirías a alguien: «quiero tener obra propia»,
        «salir de deudas», «volver a entrenar».
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="norte-label" className="text-xs font-medium text-muted">
            El frente
          </label>
          <Input
            id="norte-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Tener obra propia"
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="norte-detail" className="text-xs font-medium text-muted">
            Por qué te importa <span className="text-muted-2">(opcional)</span>
          </label>
          <Input
            id="norte-detail"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Quiero dejar de trabajar para estudios ajenos"
            className="mt-1"
          />
        </div>

        {preview.length > 0 && (
          <div className="rounded-lg bg-surface-2/60 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Así entendemos tu tema
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground">
              {preview[0]}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Buscaremos noticias que respondan a esta idea completa.
            </p>
          </div>
        )}

        <Button onClick={submit} disabled={isSaving || !label.trim()} className="w-full">
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Agregar frente
        </Button>
      </div>
    </div>
  );
}

function EditFrontRow({
  front,
  onDone,
}: {
  front: SerializedFront;
  onDone: (updated: SerializedFront | null) => void;
}) {
  const [label, setLabel] = useState(front.label);
  const [detail, setDetail] = useState(front.detail ?? "");
  const [isSaving, startSaving] = useTransition();

  const save = () => {
    const clean = label.trim();
    if (!clean) return;
    startSaving(async () => {
      const result = await updateFrontAction(front.id, {
        label: clean,
        detail: detail.trim() || null,
        topics: suggestTopics(clean, detail.trim() || null),
      });
      if (result.error || !result.front) {
        toast.error(result.error ?? "No pudimos guardar los cambios.");
        return;
      }
      toast.success("Listo.");
      onDone(result.front);
    });
  };

  return (
    <div className="space-y-3 border-b border-border bg-surface-2/30 px-4 py-4 last:border-b-0">
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="El frente" />
      <Input
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Por qué te importa"
      />
      {suggestTopics(label, detail)[0] && (
        <div className="rounded-lg bg-surface-2/60 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
            Búsqueda por intención
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {suggestTopics(label, detail)[0]}
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={save} disabled={isSaving || !label.trim()}>
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Guardar
        </Button>
        <Button variant="secondary" onClick={() => onDone(null)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
