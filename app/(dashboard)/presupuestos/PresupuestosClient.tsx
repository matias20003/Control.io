"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Target, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatMonth } from "@/lib/utils";
import {
  createOrUpdateBudgetAction,
  deleteBudgetAction,
} from "@/app/actions/budgets";
import type { SerializedBudget } from "@/lib/db/budgets";
import type { SerializedCategory } from "@/lib/db/categories";

interface Props {
  initialBudgets: SerializedBudget[];
  categories: SerializedCategory[];
  initialMonth: number;
  initialYear: number;
}

export function PresupuestosClient({
  initialBudgets,
  categories,
  initialMonth,
  initialYear,
}: Props) {
  const now = new Date();
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [budgets, setBudgets] = useState<SerializedBudget[]>(initialBudgets);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");
  const budgetCatIds = new Set(budgets.map((b) => b.categoryId));
  const availableCategories = expenseCategories.filter(
    (c) => !budgetCatIds.has(c.id)
  );

  const navigate = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    else if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
    // Re-fetch budgets for new month (server action would be needed here)
    // For now: clear budgets since month changed
    setBudgets([]);
    toast.info("Cargá presupuestos para " + formatMonth(m, y));
  };

  const handleCreate = (formData: FormData) => {
    formData.set("month", String(month));
    formData.set("year", String(year));
    startTransition(async () => {
      const result = await createOrUpdateBudgetAction(formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Presupuesto guardado");
        setIsOpen(false);
        // Reload page to get fresh data
        window.location.reload();
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteBudgetAction(id);
      if (result.error) toast.error(result.error);
      else {
        setBudgets((prev) => prev.filter((b) => b.id !== id));
        toast.success("Presupuesto eliminado");
      }
      setDeletingId(null);
    });
  };

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Presupuestos</h1>
        {availableCategories.length > 0 && (
          <Button size="sm" onClick={() => setIsOpen(true)}>
            <Plus size={16} className="mr-1.5" />
            Nuevo
          </Button>
        )}
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-foreground capitalize">
          {formatMonth(month, year)}
        </span>
        <button
          onClick={() => navigate(1)}
          disabled={
            month === now.getMonth() + 1 && year === now.getFullYear()
          }
          className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-colors disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Summary */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-2 rounded-xl p-3">
            <p className="text-xs text-muted mb-0.5">Presupuestado</p>
            <p className="text-base font-bold font-mono text-foreground">
              {formatCurrency(totalBudgeted, "ARS")}
            </p>
          </div>
          <div
            className={`rounded-xl p-3 ${
              totalSpent > totalBudgeted ? "bg-danger/10" : "bg-success/10"
            }`}
          >
            <p className="text-xs text-muted mb-0.5">Gastado</p>
            <p
              className={`text-base font-bold font-mono ${
                totalSpent > totalBudgeted ? "text-danger" : "text-success"
              }`}
            >
              {formatCurrency(totalSpent, "ARS")}
            </p>
          </div>
        </div>
      )}

      {/* Budget list */}
      {budgets.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Sin presupuestos"
          description="Establecé límites de gasto por categoría para este mes."
          action={
            expenseCategories.length > 0 ? (
              <Button onClick={() => setIsOpen(true)}>
                <Plus size={16} className="mr-1.5" />
                Nuevo presupuesto
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => {
            const isOver = b.percentage >= 100;
            const isAlert = b.percentage >= b.alertAt && !isOver;
            const barColor = isOver
              ? "bg-danger"
              : isAlert
              ? "bg-warning"
              : "bg-primary";

            return (
              <Card key={b.id} className="group">
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {b.categoryIcon || "📦"}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {b.categoryName}
                      </span>
                      {isOver && (
                        <span className="text-xs bg-danger/20 text-danger px-1.5 py-0.5 rounded-full font-medium">
                          Excedido
                        </span>
                      )}
                      {isAlert && (
                        <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded-full font-medium">
                          Alerta
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(b.id)}
                      disabled={deletingId === b.id || isPending}
                      className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(b.percentage, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>
                      {formatCurrency(b.spent, "ARS")} gastado
                    </span>
                    <span
                      className={
                        b.remaining < 0 ? "text-danger font-semibold" : ""
                      }
                    >
                      {b.remaining >= 0
                        ? `${formatCurrency(b.remaining, "ARS")} disponible`
                        : `${formatCurrency(Math.abs(b.remaining), "ARS")} excedido`}
                    </span>
                    <span className="font-medium text-foreground">
                      {b.percentage}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          title="Nuevo presupuesto"
          description={`Para ${formatMonth(month, year)}`}
        >
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="budget-cat">Categoría *</Label>
              <Select
                id="budget-cat"
                name="categoryId"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Seleccionar categoría
                </option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="budget-amount">Límite mensual (ARS) *</Label>
              <Input
                id="budget-amount"
                name="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="budget-alert">Alertar al (%) *</Label>
              <Input
                id="budget-alert"
                name="alertAt"
                type="number"
                min="1"
                max="100"
                defaultValue="80"
              />
              <p className="text-xs text-muted">
                Se mostrará alerta cuando el gasto supere este porcentaje
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
