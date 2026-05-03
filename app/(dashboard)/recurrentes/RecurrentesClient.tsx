"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, Power, Pencil } from "lucide-react";
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
} from "@/app/actions/recurrentes";
import type { SerializedRecurring } from "@/lib/db/recurrentes";
import type { SerializedCategory } from "@/lib/db/categories";

const FREQ_LABELS: Record<string, string> = {
  DAILY: "Diario",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  YEARLY: "Anual",
};

interface Props {
  initialRecurrentes: SerializedRecurring[];
  categories: SerializedCategory[];
}

export function RecurrentesClient({ initialRecurrentes, categories }: Props) {
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

  const createCategories = categories.filter((c) => c.type === createType);
  const editCategories = categories.filter((c) => c.type === editType);

  /* ── Handlers ── */

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createRecurrenteAction(formData);
      if (result.error) toast.error(result.error);
      else if (result.success && result.recurrente) {
        setItems((prev) => [result.recurrente!, ...prev]);
        setIsCreateOpen(false);
        toast.success("Recurrente creado");
      }
    });
  };

  const handleOpenEdit = (item: SerializedRecurring) => {
    setEditingItem(item);
    setEditType(item.type as "EXPENSE" | "INCOME");
  };

  const handleUpdate = (formData: FormData) => {
    if (!editingItem) return;
    startTransition(async () => {
      const result = await updateRecurrenteAction(editingItem.id, formData);
      if (result.error) toast.error(result.error);
      else if (result.success && result.recurrente) {
        setItems((prev) =>
          prev.map((r) => (r.id === editingItem.id ? result.recurrente! : r))
        );
        setEditingItem(null);
        toast.success("Recurrente actualizado");
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

  /* ── Form fields shared between create / edit ── */
  function RecurringForm({
    defaultValues,
    txType,
    onTypeChange,
    filteredCats,
    onSubmit,
    onCancel,
  }: {
    defaultValues?: SerializedRecurring;
    txType: "EXPENSE" | "INCOME";
    onTypeChange: (t: "EXPENSE" | "INCOME") => void;
    filteredCats: SerializedCategory[];
    onSubmit: (fd: FormData) => void;
    onCancel: () => void;
  }) {
    const startVal = defaultValues?.startDate
      ? defaultValues.startDate.split("T")[0]
      : new Date().toISOString().split("T")[0];
    const endVal = defaultValues?.endDate
      ? defaultValues.endDate.split("T")[0]
      : "";

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
              defaultValue={defaultValues?.frequency ?? "MONTHLY"}
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
            <Label htmlFor="rec-start">Fecha de inicio *</Label>
            <Input
              id="rec-start"
              name="startDate"
              type="date"
              defaultValue={startVal}
              required
            />
          </div>

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

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recurrentes</h1>
          <p className="text-sm text-muted mt-0.5">
            {active.length} activo{active.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} className="mr-1.5" />
          Nuevo
        </Button>
      </div>

      {/* Monthly estimate */}
      {active.length > 0 && (
        <div className="bg-danger/10 rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Gasto recurrente mensual estimado</p>
          <p className="text-xl font-bold font-mono text-danger">
            {formatCurrency(monthlyExpense, "ARS")}
          </p>
        </div>
      )}

      {/* Empty */}
      {items.length === 0 && (
        <EmptyState
          icon={RefreshCw}
          title="Sin gastos recurrentes"
          description="Registrá subscripciones, alquileres y pagos periódicos."
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} className="mr-1.5" />
              Nuevo recurrente
            </Button>
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
              deletingId={deletingId}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent title="Nuevo recurrente">
          <RecurringForm
            txType={createType}
            onTypeChange={setCreateType}
            filteredCats={createCategories}
            onSubmit={handleCreate}
            onCancel={() => setIsCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingItem} onOpenChange={(o) => { if (!o) setEditingItem(null); }}>
        <DialogContent title="Editar recurrente">
          {editingItem && (
            <RecurringForm
              key={editingItem.id}
              defaultValues={editingItem}
              txType={editType}
              onTypeChange={setEditType}
              filteredCats={editCategories}
              onSubmit={handleUpdate}
              onCancel={() => setEditingItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecurringRow({
  item,
  onEdit,
  onToggle,
  onDelete,
  deletingId,
  isPending,
}: {
  item: SerializedRecurring;
  onEdit: (item: SerializedRecurring) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
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
