"use client";
import { SectionTabs } from "@/components/layout/SectionTabs";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, PiggyBank, DollarSign, Target, TrendingUp, Pencil } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader, StatCard } from "@/components/ui/stat";
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
  updateGoalAction,
  addFundsAction,
  deleteGoalAction,
} from "@/app/actions/goals";
import type { SerializedGoal } from "@/lib/db/goals";
import type { SerializedAccount } from "@/lib/db/accounts";

interface Props {
  initialGoals: SerializedGoal[];
  accounts: SerializedAccount[];
}

export function MetasClient({ initialGoals, accounts }: Props) {
  const [goals, setGoals] = useState<SerializedGoal[]>(initialGoals);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SerializedGoal | null>(null);
  const [fundingGoal, setFundingGoal] = useState<SerializedGoal | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleUpdate = (formData: FormData) => {
    if (!editingGoal) return;
    startTransition(async () => {
      const result = await updateGoalAction(editingGoal.id, formData);
      if (result.error) toast.error(result.error);
      else if (result.success && result.goal) {
        setGoals((prev) => prev.map((g) => (g.id === editingGoal.id ? result.goal! : g)));
        setEditingGoal(null);
        toast.success("Meta actualizada");
      }
    });
  };

  const active = goals.filter((g) => !g.isCompleted);
  const completed = goals.filter((g) => g.isCompleted);

  const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = active.reduce((s, g) => s + g.targetAmount, 0);
  const avance = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

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
    const remaining = fundingGoal.targetAmount - fundingGoal.currentAmount;
    if (amount > remaining + 0.01) {
      toast.error(`Con ${formatCurrency(remaining, fundingGoal.currency)} ya completás la meta`);
      return;
    }
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

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-6">
      <SectionTabs />
      {/* Header */}
      <PageHeader
        title="Metas de ahorro"
        subtitle="Definí objetivos con monto y fecha, y seguí tu avance."
        actions={
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} className="mr-1.5" />
            Nueva
          </Button>
        }
      />

      {/* KPIs */}
      {active.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Ahorrado" value={formatCurrency(totalSaved, "ARS")} hint={`${active.length} meta${active.length !== 1 ? "s" : ""} activa${active.length !== 1 ? "s" : ""}`} icon={PiggyBank} accent="success" />
          <StatCard label="Objetivo total" value={formatCurrency(totalTarget, "ARS")} icon={Target} accent="primary" />
          <StatCard label="Avance global" value={`${avance}%`} hint={completed.length > 0 ? `${completed.length} cumplida${completed.length !== 1 ? "s" : ""}` : undefined} icon={TrendingUp} accent="warning" />
        </div>
      )}

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
                    {g.accountName && (
                      <p className="text-xs text-muted">🏦 {g.accountName}</p>
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
                  onClick={() => setEditingGoal(g)}
                  disabled={isPending}
                  title="Editar meta"
                  className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(g.id)}
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
                  onClick={() => setConfirmDeleteId(g.id)}
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

            <div className="space-y-1.5">
              <Label htmlFor="goal-account">Cuenta</Label>
              <Select id="goal-account" name="accountId" defaultValue="">
                <option value="">Sin cuenta asignada</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.icon || "🏦"} {a.name} ({a.currency})</option>
                ))}
              </Select>
              <p className="text-xs text-muted">Dónde guardás el dinero de esta meta (opcional).</p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? "Creando..." : "Crear"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {editingGoal && (
        <Dialog open={!!editingGoal} onOpenChange={(o) => { if (!o) setEditingGoal(null); }}>
          <DialogContent title="Editar meta">
            <form action={handleUpdate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-goal-name">Nombre *</Label>
                <Input id="edit-goal-name" name="name" defaultValue={editingGoal.name} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-goal-target">Objetivo *</Label>
                  <Input id="edit-goal-target" name="targetAmount" type="number" step="0.01" defaultValue={editingGoal.targetAmount} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-goal-currency">Moneda</Label>
                  <Select id="edit-goal-currency" name="currency" defaultValue={editingGoal.currency}>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-goal-deadline">Fecha límite</Label>
                <Input id="edit-goal-deadline" name="deadline" type="date" defaultValue={editingGoal.deadline ? editingGoal.deadline.split("T")[0] : ""} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-goal-icon">Ícono</Label>
                  <Input id="edit-goal-icon" name="icon" maxLength={4} defaultValue={editingGoal.icon ?? ""} placeholder="🎯" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-goal-color">Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input id="edit-goal-color" name="color" type="color" defaultValue={editingGoal.color ?? "#38bdf8"} className="h-10 w-12 p-1 cursor-pointer" />
                    <span className="text-xs text-muted">Opcional</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-goal-account">Cuenta</Label>
                <Select id="edit-goal-account" name="accountId" defaultValue={editingGoal.accountId ?? ""}>
                  <option value="">Sin cuenta asignada</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.icon || "🏦"} {a.name} ({a.currency})</option>
                  ))}
                </Select>
                <p className="text-xs text-muted">Dónde guardás el dinero de esta meta (opcional).</p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setEditingGoal(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? "Guardando..." : "Guardar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

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
                <Input type="number" step="0.01" min="0.01" max={fundingGoal.targetAmount - fundingGoal.currentAmount} value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} placeholder={`Hasta ${(fundingGoal.targetAmount - fundingGoal.currentAmount).toFixed(2)}`} />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setFundingGoal(null)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleAddFunds} disabled={isPending}>{isPending ? "Guardando..." : "Agregar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}
        title="Eliminar meta"
        description="Esta acción no se puede deshacer. El dinero de tus cuentas no se modifica."
        confirmLabel="Eliminar"
        onConfirm={() => { if (confirmDeleteId) { handleDelete(confirmDeleteId); setConfirmDeleteId(null); } }}
        isPending={isPending}
      />
    </div>
  );
}
