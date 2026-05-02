"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, PiggyBank, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  createGoalAction,
  addFundsAction,
  deleteGoalAction,
} from "@/app/actions/goals";
import type { SerializedGoal } from "@/lib/db/goals";

interface Props {
  initialGoals: SerializedGoal[];
}

export function MetasClient({ initialGoals }: Props) {
  const [goals, setGoals] = useState<SerializedGoal[]>(initialGoals);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [fundingGoal, setFundingGoal] = useState<SerializedGoal | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const active = goals.filter((g) => !g.isCompleted);
  const completed = goals.filter((g) => g.isCompleted);

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createGoalAction(formData);
      if (result.error) toast.error(result.error);
      else if (result.success && result.goal) {
        setGoals((prev) => [result.goal!, ...prev]);
        setIsCreateOpen(false);
        toast.success("Meta creada");
      }
    });
  };

  const handleAddFunds = () => {
    if (!fundingGoal) return;
    const amount = parseFloat(fundAmount);
    if (!amount || amount <= 0) { toast.error("Ingresá un monto válido"); return; }
    startTransition(async () => {
      const result = await addFundsAction(fundingGoal.id, amount);
      if (result.error) toast.error(result.error);
      else if (result.success && result.goal) {
        setGoals((prev) => prev.map((g) => (g.id === result.goal!.id ? result.goal! : g)));
        setFundingGoal(null);
        setFundAmount("");
        toast.success(result.goal.isCompleted ? "¡Meta cumplida! 🎉" : "Fondos agregados");
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteGoalAction(id);
      if (result.error) toast.error(result.error);
      else { setGoals((prev) => prev.filter((g) => g.id !== id)); toast.success("Meta eliminada"); }
      setDeletingId(null);
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Metas de ahorro</h1>
          <p className="text-sm text-muted mt-0.5">
            {active.length} activa{active.length !== 1 ? "s" : ""}
            {completed.length > 0 && ` · ${completed.length} cumplida${completed.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} className="mr-1.5" />
          Nueva
        </Button>
      </div>

      {/* Empty */}
      {goals.length === 0 && (
        <EmptyState
          icon={PiggyBank}
          title="Sin metas de ahorro"
          description="Creá objetivos de ahorro con un monto y fecha límite."
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} className="mr-1.5" />
              Nueva meta
            </Button>
          }
        />
      )}

      {/* Active goals */}
      {active.map((g) => {
        const daysLeft = g.deadline
          ? Math.ceil(
              (new Date(g.deadline).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            )
          : null;
        const remaining = g.targetAmount - g.currentAmount;

        return (
          <Card key={g.id} className="group">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{
                      backgroundColor: g.color ? `${g.color}25` : "var(--color-surface-2)",
                    }}
                  >
                    {g.icon || "🎯"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{g.name}</p>
                    {g.deadline && (
                      <p className={`text-xs ${daysLeft !== null && daysLeft < 30 ? "text-warning" : "text-muted"}`}>
                        {daysLeft !== null && daysLeft >= 0
                          ? `${daysLeft} día${daysLeft !== 1 ? "s" : ""} restantes`
                          : `Vencida ${formatDate(g.deadline)}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold font-mono text-foreground">
                    {formatCurrency(g.currentAmount, g.currency)}
                  </p>
                  <p className="text-xs text-muted">
                    de {formatCurrency(g.targetAmount, g.currency)}
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="h-2 rounded-full bg-surface-2 overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${g.percentage}%`,
                      backgroundColor: g.color || "var(--color-primary)",
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{g.percentage}% alcanzado</span>
                  <span>{formatCurrency(remaining, g.currency)} restante</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { setFundingGoal(g); setFundAmount(""); }}
                  disabled={isPending}
                  className="h-7 px-2 text-xs"
                >
                  <DollarSign size={12} className="mr-1" />
                  Agregar
                </Button>
                <button
                  onClick={() => handleDelete(g.id)}
                  disabled={deletingId === g.id || isPending}
                  className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">
            Cumplidas 🎉 ({completed.length})
          </p>
          {completed.map((g) => (
            <Card key={g.id} className="group opacity-70">
              <CardContent className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{g.icon || "🎯"}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground line-through">{g.name}</p>
                    <p className="text-xs text-muted">
                      {formatCurrency(g.targetAmount, g.currency)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(g.id)}
                  disabled={deletingId === g.id || isPending}
                  className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent title="Nueva meta de ahorro">
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="goal-name">Nombre *</Label>
              <Input id="goal-name" name="name" placeholder="Ej: Vacaciones, iPhone, Fondo de emergencia" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-target">Objetivo *</Label>
                <Input id="goal-target" name="targetAmount" type="number" step="0.01" placeholder="0.00" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-currency">Moneda</Label>
                <Select id="goal-currency" name="currency" defaultValue="ARS">
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goal-current">Monto actual</Label>
              <Input id="goal-current" name="currentAmount" type="number" step="0.01" defaultValue="0" placeholder="0.00" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goal-deadline">Fecha límite</Label>
              <Input id="goal-deadline" name="deadline" type="date" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-icon">Ícono</Label>
                <Input id="goal-icon" name="icon" placeholder="🎯" maxLength={4} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-color">Color</Label>
                <div className="flex gap-2 items-center">
                  <Input id="goal-color" name="color" type="color" defaultValue="#38bdf8" className="h-10 w-12 p-1 cursor-pointer" />
                  <span className="text-xs text-muted">Opcional</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? "Creando..." : "Crear"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add funds dialog */}
      {fundingGoal && (
        <Dialog open={!!fundingGoal} onOpenChange={() => setFundingGoal(null)}>
          <DialogContent title={`Agregar fondos — ${fundingGoal.name}`}>
            <div className="space-y-4">
              <div className="bg-surface-2 rounded-xl p-3 text-sm flex justify-between">
                <span className="text-muted">Falta</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(fundingGoal.targetAmount - fundingGoal.currentAmount, fundingGoal.currency)}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label>Monto *</Label>
                <Input type="number" step="0.01" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setFundingGoal(null)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleAddFunds} disabled={isPending}>{isPending ? "Guardando..." : "Agregar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
