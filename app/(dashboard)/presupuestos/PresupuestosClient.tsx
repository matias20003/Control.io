"use client";
import { SectionTabs } from "@/components/layout/SectionTabs";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Target, ChevronLeft, ChevronRight, Wallet, TrendingDown, PiggyBank, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui/stat";
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
  getBudgetsAction,
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

  const loadMonth = (m: number, y: number) => {
    startTransition(async () => {
      const res = await getBudgetsAction(m, y);
      if ("error" in res) {
        toast.error(res.error);
        setBudgets([]);
      } else {
        setBudgets(res.budgets);
      }
    });
  };

  const navigate = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    else if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
    // Traemos los presupuestos reales del mes elegido (antes mostraba vacío falso).
    loadMonth(m, y);
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
        // Refrescamos en el lugar (antes recargaba toda la página).
        const res = await getBudgetsAction(month, year);
        if (!("error" in res)) setBudgets(res.budgets);
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
  const overBudgets = budgets.filter((b) => b.percentage >= 100);
  const alertBudgets = budgets.filter((b) => b.percentage >= b.alertAt && b.percentage < 100);

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-5">
      <SectionTabs />
      {/* Header */}
      <PageHeader
        title="Presupuestos"
        subtitle="Definí límites de gasto por categoría y seguí tu avance del mes."
        actions={
          availableCategories.length > 0 ? (
            <Button size="sm" onClick={() => setIsOpen(true)}>
              <Plus size={16} className="mr-1.5" />
              Nuevo
            </Button>
          ) : undefined
        }
      />

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-foreground">
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

      {/* KPIs */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Presupuestado" value={formatCurrency(totalBudgeted, "ARS")} hint={formatMonth(month, year)} icon={Wallet} accent="primary" />
          <StatCard
            label="Gastado"
            value={formatCurrency(totalSpent, "ARS")}
            hint={totalBudgeted > 0 ? `${Math.round((totalSpent / totalBudgeted) * 100)}% del presupuesto` : undefined}
            icon={TrendingDown}
            accent={totalSpent > totalBudgeted ? "danger" : "success"}
          />
          <StatCard
            label="Disponible"
            value={formatCurrency(totalBudgeted - totalSpent, "ARS")}
            hint={totalBudgeted > 0 ? `${Math.max(0, Math.round(((totalBudgeted - totalSpent) / totalBudgeted) * 100))}% restante` : undefined}
            icon={PiggyBank}
            accent={totalBudgeted - totalSpent >= 0 ? "success" : "danger"}
          />
        </div>
      )}

      {/* Estado general del presupuesto */}
      {budgets.length > 0 && totalBudgeted > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Estado general del presupuesto</p>
            <div className="flex h-9 rounded-lg overflow-hidden bg-surface-2">
              {budgets.map((b) => {
                const share = Math.round((b.amount / totalBudgeted) * 100);
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-center text-[11px] font-semibold text-white/90 min-w-0"
                    style={{ width: `${share}%`, backgroundColor: b.categoryColor || "#3b82f6" }}
                    title={`${b.categoryName} · ${share}%`}
                  >
                    {share >= 8 && <span className="truncate px-1">{b.categoryIcon} {share}%</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
              {budgets.map((b) => (
                <div key={b.id} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.categoryColor || "#3b82f6" }} />
                  <span className="text-xs text-foreground">{b.categoryName}</span>
                  <span className="text-xs text-muted">{Math.round((b.amount / totalBudgeted) * 100)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-2">
          <p className="text-sm font-semibold text-foreground mb-1">Detalle por categoría</p>
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

          {/* Aside: alertas y recomendaciones */}
          <aside className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-foreground mb-3">Alertas y recomendaciones</p>
                <div className="space-y-3">
                  {overBudgets.map((b) => (
                    <div key={b.id} className="flex gap-3">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-surface-2 text-danger"><AlertTriangle size={15} /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-danger">{b.categoryName} excedido</p>
                        <p className="text-xs text-muted mt-0.5 leading-snug">Vas {b.percentage - 100}% por encima del presupuesto.</p>
                      </div>
                    </div>
                  ))}
                  {alertBudgets.map((b) => (
                    <div key={b.id} className="flex gap-3">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-surface-2 text-warning"><Clock size={15} /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-warning">{b.categoryName} cerca del límite</p>
                        <p className="text-xs text-muted mt-0.5 leading-snug">Llevás {b.percentage}% del presupuesto asignado.</p>
                      </div>
                    </div>
                  ))}
                  {overBudgets.length === 0 && alertBudgets.length === 0 && (
                    <div className="flex gap-3">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-surface-2 text-success"><CheckCircle2 size={15} /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-success">¡Vas por buen camino!</p>
                        <p className="text-xs text-muted mt-0.5 leading-snug">Todas tus categorías están bajo control este mes.</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>
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
