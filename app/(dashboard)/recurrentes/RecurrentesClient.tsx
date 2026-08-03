"use client";
import { SectionTabs } from "@/components/layout/SectionTabs";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, RefreshCw, Power, Pencil, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  createRecurrenteAction,
  updateRecurrenteAction,
  toggleRecurrenteAction,
  deleteRecurrenteAction,
  runRecurrenteNowAction,
} from "@/app/actions/recurrentes";
import type { SerializedRecurring } from "@/lib/db/recurrentes";
import type { SerializedCategory } from "@/lib/db/categories";
import type { SerializedAccount } from "@/lib/db/accounts";

const FREQ_LABELS: Record<string, string> = {
  DAILY: "Diario",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  YEARLY: "Anual",
};

/** Cómo se lee "el período que viene" según la frecuencia elegida. */
const NEXT_PERIOD_LABELS: Record<string, string> = {
  DAILY: "mañana",
  WEEKLY: "la semana que viene",
  BIWEEKLY: "la quincena que viene",
  MONTHLY: "el mes que viene",
  QUARTERLY: "el trimestre que viene",
  YEARLY: "el año que viene",
};

interface Props {
  initialRecurrentes: SerializedRecurring[];
  categories: SerializedCategory[];
  accounts: SerializedAccount[];
}

export function RecurrentesClient({ initialRecurrentes, categories, accounts }: Props) {
  const [items, setItems] = useState<SerializedRecurring[]>(initialRecurrentes);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SerializedRecurring | null>(null);
  const [createType, setCreateType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [editType, setEditType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const active = items.filter((r) => r.isActive);
  const inactive = items.filter((r) => !r.isActive);

  const monthlyExpense = active
    .filter((r) => r.type === "EXPENSE")
    .reduce((s, r) => {
      const factor =
        r.frequency === "DAILY" ? 30
        : r.frequency === "WEEKLY" ? 4.3
        : r.frequency === "BIWEEKLY" ? 2
        : r.frequency === "MONTHLY" ? 1
        : r.frequency === "QUARTERLY" ? 1 / 3
        : 1 / 12;
      return s + r.amount * factor;
    }, 0);

  const monthlyIncome = active
    .filter((r) => r.type === "INCOME")
    .reduce((s, r) => {
      const factor =
        r.frequency === "DAILY" ? 30
        : r.frequency === "WEEKLY" ? 4.3
        : r.frequency === "BIWEEKLY" ? 2
        : r.frequency === "MONTHLY" ? 1
        : r.frequency === "QUARTERLY" ? 1 / 3
        : 1 / 12;
      return s + r.amount * factor;
    }, 0);

  const createCategories = categories.filter((c) => c.type === createType);
  const editCategories = categories.filter((c) => c.type === editType);

  /* ── Handlers ── */

  const openCreate = (type: "EXPENSE" | "INCOME") => {
    setCreateType(type);
    setIsCreateOpen(true);
  };

  const handleCreate = (formData: FormData) => {
    const type = formData.get("type") === "INCOME" ? "INCOME" : "EXPENSE";
    startTransition(async () => {
      const result = await createRecurrenteAction(formData);
      if (result.error) toast.error(result.error);
      else if (result.success && result.recurrente) {
        setItems((prev) => [result.recurrente!, ...prev]);
        setIsCreateOpen(false);
        const base = type === "INCOME" ? "Ingreso fijo creado" : "Gasto fijo creado";
        toast.success(result.charged ? `${base} — ya impactó en el neto` : base);
      }
    });
  };

  const handleOpenEdit = (item: SerializedRecurring) => {
    setEditingItem(item);
    setEditType(item.type as "EXPENSE" | "INCOME");
  };

  const handleUpdate = (formData: FormData) => {
    if (!editingItem) return;
    const type = formData.get("type") === "INCOME" ? "INCOME" : "EXPENSE";
    startTransition(async () => {
      const result = await updateRecurrenteAction(editingItem.id, formData);
      if (result.error) toast.error(result.error);
      else if (result.success && result.recurrente) {
        setItems((prev) =>
          prev.map((r) => (r.id === editingItem.id ? result.recurrente! : r))
        );
        setEditingItem(null);
        toast.success(type === "INCOME" ? "Ingreso fijo actualizado" : "Gasto fijo actualizado");
      }
    });
  };

  const handleToggle = (id: string) => {
    startTransition(async () => {
      const result = await toggleRecurrenteAction(id);
      if (result.error) toast.error(result.error);
      else if (result.success && result.recurrente) {
        setItems((prev) =>
          prev.map((r) => (r.id === id ? result.recurrente! : r))
        );
      }
    });
  };

  /** Registra el pago del período actual sin esperar al cron del día siguiente. */
  const handleRunNow = (id: string) => {
    startTransition(async () => {
      const result = await runRecurrenteNowAction(id);
      if (result.error) toast.error(result.error);
      else if (result.success && result.recurrente) {
        setItems((prev) => prev.map((r) => (r.id === id ? result.recurrente! : r)));
        toast.success("Pago registrado — ya se descontó del neto");
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteRecurrenteAction(id);
      if (result.error) toast.error(result.error);
      else {
        setItems((prev) => prev.filter((r) => r.id !== id));
        toast.success("Eliminado");
      }
      setDeletingId(null);
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-6">
      <SectionTabs />
      {/* Header */}
      <PageHeader
        title="Ingresos y gastos fijos"
        subtitle="Sueldos, suscripciones, alquileres y otros movimientos periódicos automatizados."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => openCreate("EXPENSE")}>
              <TrendingDown size={16} className="mr-1.5 text-danger" />
              Nuevo gasto fijo
            </Button>
            <Button size="sm" onClick={() => openCreate("INCOME")}>
              <TrendingUp size={16} className="mr-1.5" />
              Nuevo ingreso fijo
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      {active.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Gasto mensual estimado" value={formatCurrency(monthlyExpense, "ARS")} icon={TrendingDown} accent="danger" />
          <StatCard label="Ingreso mensual estimado" value={formatCurrency(monthlyIncome, "ARS")} icon={TrendingUp} accent="success" />
          <StatCard label="Movimientos fijos activos" value={active.length} hint={inactive.length > 0 ? `${inactive.length} pausado${inactive.length !== 1 ? "s" : ""}` : undefined} icon={RefreshCw} accent="primary" />
        </div>
      )}

      {/* Empty */}
      {items.length === 0 && (
        <EmptyState
          icon={RefreshCw}
          title="Sin movimientos fijos"
          description="Registrá ingresos, suscripciones, alquileres y otros movimientos periódicos."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => openCreate("EXPENSE")}>
                <TrendingDown size={16} className="mr-1.5 text-danger" />
                Nuevo gasto fijo
              </Button>
              <Button onClick={() => openCreate("INCOME")}>
                <TrendingUp size={16} className="mr-1.5" />
                Nuevo ingreso fijo
              </Button>
            </div>
          }
        />
      )}

      {/* Active */}
      {active.length > 0 && (
        <div className="space-y-2">
          {active.map((r) => (
            <RecurringRow
              key={r.id}
              item={r}
              onEdit={handleOpenEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onRunNow={handleRunNow}
              deletingId={deletingId}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Inactive */}
      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">
            Pausados ({inactive.length})
          </p>
          {inactive.map((r) => (
            <RecurringRow
              key={r.id}
              item={r}
              onEdit={handleOpenEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onRunNow={handleRunNow}
              deletingId={deletingId}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent title={createType === "INCOME" ? "Nuevo ingreso fijo" : "Nuevo gasto fijo"}>
          <RecurringForm
            mode="create"
            txType={createType}
            onTypeChange={setCreateType}
            filteredCats={createCategories}
            accounts={accounts}
            isPending={isPending}
            onSubmit={handleCreate}
            onCancel={() => setIsCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingItem} onOpenChange={(o) => { if (!o) setEditingItem(null); }}>
        <DialogContent title={editType === "INCOME" ? "Editar ingreso fijo" : "Editar gasto fijo"}>
          {editingItem && (
            <RecurringForm
              key={editingItem.id}
              mode="edit"
              defaultValues={editingItem}
              txType={editType}
              onTypeChange={setEditType}
              filteredCats={editCategories}
              accounts={accounts}
              isPending={isPending}
              onSubmit={handleUpdate}
              onCancel={() => setEditingItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Formulario compartido entre alta y edición.
 *
 * Vive a nivel de módulo (y no dentro de RecurrentesClient) porque si se declara
 * adentro React lo trata como un componente nuevo en cada render del padre y
 * remonta el form: cambiar de Gasto a Ingreso borraba lo que ya estaba tipeado.
 */
function RecurringForm({
  mode,
  defaultValues,
  txType,
  onTypeChange,
  filteredCats,
  accounts,
  isPending,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  defaultValues?: SerializedRecurring;
  txType: "EXPENSE" | "INCOME";
  onTypeChange: (t: "EXPENSE" | "INCOME") => void;
  filteredCats: SerializedCategory[];
  accounts: SerializedAccount[];
  isPending: boolean;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
}) {
  const startVal = defaultValues?.startDate
    ? defaultValues.startDate.split("T")[0]
    : new Date().toISOString().split("T")[0];
  const endVal = defaultValues?.endDate
    ? defaultValues.endDate.split("T")[0]
    : "";

  const [frequency, setFrequency] = useState(defaultValues?.frequency ?? "MONTHLY");
  const [firstCharge, setFirstCharge] = useState<"NOW" | "NEXT">("NOW");
  const nextPeriod = NEXT_PERIOD_LABELS[frequency] ?? "el período que viene";
  const isExpense = txType === "EXPENSE";

  return (
    <>
      {/* Type tabs */}
      <div className="flex rounded-xl overflow-hidden border border-border mb-4">
        {(["EXPENSE", "INCOME"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTypeChange(t)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              txType === t
                ? t === "EXPENSE"
                  ? "bg-danger text-white"
                  : "bg-success text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {t === "EXPENSE" ? "Gasto" : "Ingreso"}
          </button>
        ))}
      </div>

      <form action={onSubmit} className="space-y-4">
        <input type="hidden" name="type" value={txType} />

        <div className="space-y-1.5">
          <Label htmlFor="rec-desc">Descripción *</Label>
          <Input
            id="rec-desc"
            name="description"
            placeholder="Ej: Netflix, Alquiler, Sueldo"
            defaultValue={defaultValues?.description ?? ""}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rec-amount">Monto *</Label>
            <Input
              id="rec-amount"
              name="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              defaultValue={defaultValues?.amount ?? ""}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-currency">Moneda</Label>
            <Select
              id="rec-currency"
              name="currency"
              defaultValue={defaultValues?.currency ?? "ARS"}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rec-freq">Frecuencia *</Label>
          <Select
            id="rec-freq"
            name="frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            required
          >
            {Object.entries(FREQ_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rec-cat">Categoría</Label>
          <Select
            id="rec-cat"
            name="categoryId"
            defaultValue={defaultValues?.categoryId ?? ""}
          >
            <option value="">Sin categoría</option>
            {filteredCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rec-account">
            {isExpense ? "¿De qué cuenta se descuenta? *" : "¿En qué cuenta entra? *"}
          </Label>
          <Select
            id="rec-account"
            name="accountId"
            defaultValue={defaultValues?.accountId ?? ""}
          >
            <option value="">Sin cuenta (no afecta saldo)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon ?? "🏦"} {a.name} ({a.currency})
              </option>
            ))}
          </Select>
          <p className="text-[11px] text-muted leading-snug">
            Elegí la cuenta real (Mercado Pago, banco, efectivo): cada vez que se
            ejecute, el monto se {isExpense ? "descuenta" : "suma"} de ese saldo.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rec-start">Fecha de inicio *</Label>
          <Input
            id="rec-start"
            name="startDate"
            type="date"
            defaultValue={startVal}
            required
          />
          <p className="text-[11px] text-muted leading-snug">
            El día de esta fecha es el que se repite (ej: si ponés el 3, se cobra
            el 3 de cada mes).
          </p>
        </div>

        {/* Cuándo empieza a impactar. Sólo en el alta: después ya hay historial. */}
        {mode === "create" && (
          <div className="space-y-1.5">
            <Label>{isExpense ? "¿Cuándo se descuenta?" : "¿Cuándo se acredita?"}</Label>
            <input type="hidden" name="firstCharge" value={firstCharge} />
            <div className="grid gap-2">
              {(
                [
                  {
                    value: "NOW" as const,
                    title: isExpense ? "Descontarlo ya" : "Acreditarlo ya",
                    hint: `Lo registra hoy y se ve en el neto del mes. El próximo, ${nextPeriod}.`,
                  },
                  {
                    value: "NEXT" as const,
                    title: `A partir de ${nextPeriod}`,
                    hint: "No mueve nada ahora; arranca recién en la próxima fecha.",
                  },
                ]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFirstCharge(opt.value)}
                  className={`text-left rounded-xl border p-3 transition-colors ${
                    firstCharge === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-surface-2"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">{opt.title}</p>
                  <p className="text-[11px] text-muted leading-snug mt-0.5">{opt.hint}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="rec-end">Fecha de fin (opcional)</Label>
          <Input
            id="rec-end"
            name="endDate"
            type="date"
            defaultValue={endVal}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </>
  );
}

function RecurringRow({
  item,
  onEdit,
  onToggle,
  onDelete,
  onRunNow,
  deletingId,
  isPending,
}: {
  item: SerializedRecurring;
  onEdit: (item: SerializedRecurring) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRunNow: (id: string) => void;
  deletingId: string | null;
  isPending: boolean;
}) {
  return (
    <Card className={`group ${!item.isActive ? "opacity-60" : ""}`}>
      <CardContent className="p-3.5">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${
              item.type === "EXPENSE" ? "bg-danger/10" : "bg-success/10"
            }`}
          >
            {item.categoryIcon || (item.type === "EXPENSE" ? "💸" : "💰")}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {item.description}
            </p>
            <p className="text-xs text-muted">
              {FREQ_LABELS[item.frequency]}
              {item.categoryName && ` · ${item.categoryName}`}
              {item.accountName ? ` · ${item.accountName}` : " · Sin cuenta"}
            </p>
          </div>

          <p
            className={`text-sm font-bold font-mono flex-shrink-0 ${
              item.type === "EXPENSE" ? "text-danger" : "text-success"
            }`}
          >
            {item.type === "EXPENSE" ? "−" : "+"}
            {formatCurrency(item.amount, item.currency)}
          </p>

          <div className="flex items-center gap-1 flex-shrink-0">
            {item.isActive && (
              <button
                onClick={() => onRunNow(item.id)}
                disabled={isPending}
                title="Registrar el pago de este período ahora"
                className="p-1.5 rounded-lg text-muted hover:text-warning hover:bg-warning/10 transition-colors disabled:opacity-50"
              >
                <Zap size={13} />
              </button>
            )}
            <button
              onClick={() => onEdit(item)}
              disabled={isPending}
              title="Editar"
              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onToggle(item.id)}
              disabled={isPending}
              title={item.isActive ? "Pausar" : "Activar"}
              className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                item.isActive
                  ? "text-primary hover:text-muted hover:bg-surface-2"
                  : "text-muted hover:text-primary hover:bg-primary/10"
              }`}
            >
              <Power size={13} />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              disabled={deletingId === item.id || isPending}
              className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
