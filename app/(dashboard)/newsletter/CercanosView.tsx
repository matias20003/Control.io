"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  archiveCircleContactAction,
  createCircleContactAction,
  recordCircleTouchAction,
  updateCircleContactAction,
} from "@/app/actions/circle";
import type { CircleContact } from "@/lib/db/circle";
import {
  CADENCE_PRESETS,
  TIER_LABELS,
  cadenceBudget,
  cadenceLabel,
  rankDueContacts,
  sinceLabel,
  tierForCadence,
  type CircleTier,
} from "@/lib/circle-cadence";
import { SectionHeading, QuietEmpty } from "./CircleUI";

const TIER_ORDER: CircleTier[] = ["INTIMATE", "CLOSE", "ORBIT"];

function whatsappLink(phone: string): string {
  return `https://wa.me/${phone}`;
}

export function CercanosView({
  contacts,
  onContactsChange,
}: {
  contacts: CircleContact[];
  onContactsChange: (next: CircleContact[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // El estado de cadencia lo calcula el server al serializar, así que acá sólo
  // se ordena y se recorta: el cliente nunca lee el reloj.
  const dueToday = useMemo(() => rankDueContacts(contacts), [contacts]);
  const budget = useMemo(() => cadenceBudget(contacts), [contacts]);

  const grouped = useMemo(() => {
    return TIER_ORDER.map((tier) => ({
      tier,
      people: contacts
        .filter((contact) => tierForCadence(contact.cadenceDays) === tier)
        .sort((a, b) => b.overdueDays - a.overdueDays),
    })).filter((group) => group.people.length > 0);
  }, [contacts]);

  const replace = (contact: CircleContact) => {
    onContactsChange(
      contacts.map((item) => (item.id === contact.id ? contact : item)),
    );
  };

  const registerTouch = (contact: { id: string; name: string }) => {
    startTransition(async () => {
      const result = await recordCircleTouchAction(contact.id);
      if (result.error || !result.contact) {
        toast.error(result.error ?? "No pudimos registrar la conversación.");
        return;
      }
      replace(result.contact);
      toast.success(`Anotado: hablaste con ${contact.name}.`);
    });
  };

  const archive = (contact: CircleContact) => {
    startTransition(async () => {
      const result = await archiveCircleContactAction(contact.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onContactsChange(contacts.filter((item) => item.id !== contact.id));
      toast.success(`${contact.name} salió de tu círculo.`);
    });
  };

  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="La gente que querés"
        title="Cercanos"
        description="Acá no hay contenido: hay personas y cuánto hace que no hablás. La lista puede ser grande — lo que se mantiene chico es cuántas te pide la app por día."
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <TodayCard
            people={dueToday}
            busy={isPending}
            onTouch={registerTouch}
            hasContacts={contacts.length > 0}
          />
          <AddContactForm
            onAdded={(contact) => onContactsChange([...contacts, contact])}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface/45">
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-news text-xl text-foreground">Tu círculo</h3>
            <p className="mt-1 text-xs text-muted">
              {contacts.length} {contacts.length === 1 ? "persona" : "personas"}
              {contacts.length > 0 &&
                ` · ${budget.perWeek.toFixed(1)} conversaciones por semana`}
            </p>
          </div>

          {budget.isOverloaded && (
            <p className="border-b border-border bg-warning-dim px-5 py-3 text-xs leading-relaxed text-warning">
              Con estas frecuencias tu círculo te va a pedir más de{" "}
              {Math.round(budget.perDay)} conversaciones por día. Bajale la
              frecuencia a algunas personas para que esto no se vuelva una lista
              de deudas.
            </p>
          )}

          {grouped.map((group) => (
            <div key={group.tier}>
              <p className="border-b border-border bg-surface-2/40 px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                {TIER_LABELS[group.tier]}
              </p>
              {group.people.map((contact) =>
                editingId === contact.id ? (
                  <EditContactRow
                    key={contact.id}
                    contact={contact}
                    onDone={(updated) => {
                      if (updated) replace(updated);
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    busy={isPending}
                    onTouch={() => registerTouch(contact)}
                    onEdit={() => setEditingId(contact.id)}
                    onArchive={() => archive(contact)}
                  />
                ),
              )}
            </div>
          ))}

          {contacts.length === 0 && (
            <QuietEmpty text="Todavía no hay nadie. Empezá por las personas que no querés perder de vista." />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * La superficie diaria. Como mucho dos personas — y cuando no toca nadie, lo
 * dice y se termina ahí. Eso es lo que evita que esto sea una lista de culpas.
 */
function TodayCard({
  people,
  busy,
  onTouch,
  hasContacts,
}: {
  people: CircleContact[];
  busy: boolean;
  onTouch: (contact: { id: string; name: string }) => void;
  hasContacts: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
        Hoy
      </p>

      {people.length === 0 && (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {hasContacts
            ? "Estás al día con tu círculo. No hay nada que hacer acá hoy."
            : "Cuando agregues personas, acá va a aparecer con quién conviene hablar."}
        </p>
      )}

      {people.map((contact) => (
        <div key={contact.id} className="mt-4 border-t border-border pt-4 first:mt-3 first:border-t-0 first:pt-0">
          <p className="font-news text-2xl text-foreground">{contact.name}</p>
          <p className="mt-1 text-sm text-muted">
            {contact.neverContacted
              ? "Todavía no registraste ninguna conversación."
              : `Última conversación ${sinceLabel(contact.daysSince, false)}.`}
          </p>
          {contact.note && (
            <p className="mt-2 rounded-lg bg-surface-2/60 px-3 py-2 text-sm leading-relaxed text-foreground">
              {contact.note}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {contact.phone && (
              <a
                href={whatsappLink(contact.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-background hover:bg-primary-dark"
              >
                <MessageCircle size={16} />
                Escribirle
              </a>
            )}
            <Button
              variant="secondary"
              onClick={() => onTouch(contact)}
              disabled={busy}
            >
              <Check size={16} />
              Ya hablamos
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactRow({
  contact,
  busy,
  onTouch,
  onEdit,
  onArchive,
}: {
  contact: CircleContact;
  busy: boolean;
  onTouch: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="flex min-h-20 items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
          contact.isDue ? "bg-primary/10 text-primary" : "bg-surface-3 text-muted"
        }`}
      >
        <UserRound size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {contact.name}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {sinceLabel(contact.daysSince, contact.neverContacted)} ·{" "}
          {cadenceLabel(contact.cadenceDays).toLowerCase()}
        </p>
      </div>
      {contact.phone && (
        <a
          href={whatsappLink(contact.phone)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Escribirle a ${contact.name}`}
          className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-primary/8 hover:text-primary"
        >
          <MessageCircle size={17} />
        </a>
      )}
      <button
        type="button"
        onClick={onTouch}
        disabled={busy}
        aria-label={`Registrar que hablaste con ${contact.name}`}
        className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-success-dim hover:text-success disabled:opacity-50"
      >
        <Check size={17} />
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar a ${contact.name}`}
        className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-surface-3"
      >
        <Pencil size={16} />
      </button>
      <button
        type="button"
        onClick={onArchive}
        disabled={busy}
        aria-label={`Sacar a ${contact.name} del círculo`}
        className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-danger-dim hover:text-danger disabled:opacity-50"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function CadenceSelect({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (days: number) => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
    >
      {CADENCE_PRESETS.map((preset) => (
        <option key={preset.days} value={preset.days}>
          {preset.label}
        </option>
      ))}
    </select>
  );
}

function AddContactForm({ onAdded }: { onAdded: (contact: CircleContact) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [cadenceDays, setCadenceDays] = useState(28);
  const [contactedToday, setContactedToday] = useState(true);
  const [isSaving, startSaving] = useTransition();

  const submit = () => {
    const clean = name.trim();
    if (!clean) return;
    startSaving(async () => {
      const result = await createCircleContactAction({
        name: clean,
        phone: phone.trim() || null,
        note: note.trim() || null,
        cadenceDays,
        contactedToday,
      });
      if (result.error || !result.contact) {
        toast.error(result.error ?? "No pudimos agregar a esta persona.");
        return;
      }
      onAdded(result.contact);
      setName("");
      setPhone("");
      setNote("");
      toast.success(`${clean} entró a tu círculo.`);
    });
  };

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-5">
      <p className="text-sm font-semibold text-foreground">Sumar a alguien</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        No hace falta que entre todo el mundo de una. Empezá por quien no querés
        que se te pase.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="circle-name" className="text-xs font-medium text-muted">
            Nombre
          </label>
          <Input
            id="circle-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Mateo"
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="circle-phone" className="text-xs font-medium text-muted">
            WhatsApp <span className="text-muted-2">(opcional)</span>
          </label>
          <Input
            id="circle-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="5493411234567"
            inputMode="tel"
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="circle-cadence" className="text-xs font-medium text-muted">
            Cada cuánto querés hablarle
          </label>
          <div className="mt-1">
            <CadenceSelect id="circle-cadence" value={cadenceDays} onChange={setCadenceDays} />
          </div>
        </div>

        <div>
          <label htmlFor="circle-note" className="text-xs font-medium text-muted">
            Nota <span className="text-muted-2">(opcional)</span>
          </label>
          <Input
            id="circle-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Le prometí el contacto del pintor"
            className="mt-1"
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={contactedToday}
            onChange={(event) => setContactedToday(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Hablamos hace poco
        </label>
        <p className="-mt-1 text-xs leading-relaxed text-muted">
          Si lo destildás, esta persona te va a aparecer enseguida.
        </p>

        <Button onClick={submit} disabled={isSaving || !name.trim()} className="w-full">
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Sumar a mi círculo
        </Button>
      </div>
    </div>
  );
}

function EditContactRow({
  contact,
  onDone,
}: {
  contact: CircleContact;
  onDone: (updated: CircleContact | null) => void;
}) {
  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [note, setNote] = useState(contact.note ?? "");
  const [cadenceDays, setCadenceDays] = useState(contact.cadenceDays);
  const [isSaving, startSaving] = useTransition();

  const save = () => {
    const clean = name.trim();
    if (!clean) return;
    startSaving(async () => {
      const result = await updateCircleContactAction(contact.id, {
        name: clean,
        phone: phone.trim() || null,
        note: note.trim() || null,
        cadenceDays,
      });
      if (result.error || !result.contact) {
        toast.error(result.error ?? "No pudimos guardar los cambios.");
        return;
      }
      toast.success("Listo.");
      onDone(result.contact);
    });
  };

  return (
    <div className="space-y-3 border-b border-border bg-surface-2/30 px-4 py-4 last:border-b-0">
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre" />
      <Input
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="WhatsApp"
        inputMode="tel"
      />
      <CadenceSelect value={cadenceDays} onChange={setCadenceDays} />
      <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota" />
      <div className="flex gap-2">
        <Button onClick={save} disabled={isSaving || !name.trim()}>
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
