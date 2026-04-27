"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Check, Trash2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  createCreditPurchaseAction,
  payInstallmentAction,
  deleteCreditPurchaseAction,
} from "@/app/actions/credit";
import type {
  SerializedCreditPurchase,
  SerializedCreditInstallment,
} from "@/lib/db/credit";
import type { SerializedAccount } from "@/lib/db/accounts";
import type { SerializedCategory } from "@/lib/db/categories";

interface Props {
  initialPurchases: SerializedCreditPurchase[];
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
}

export function CuotasClient({ initialPurchases, accounts, categories }: Props) {
  const [purchases, setPurchases] =
    useState<SerializedCreditPurchase[]>(initialPurchases);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const creditAccounts = accounts.filter(
    (a) => a.type === "CREDIT_CARD"
  );

  const activePurchases = purchases.filter(
    (p) => p.paidInstallments < p.totalInstallments
  );
  const completedPurchases = purchases.filter(
    (p) => p.paidInstallments >= p.totalInstallments
  );

  const totalMonthly = activePurchases.reduce((s, p) => {
    const nextUnpaid = p.installments.find((i) => !i.isPaid);
    return s + (nextUnpaid?.amount ?? 0);
  }, 0);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createCreditPurchaseAction(formData);
      if (result.error) toast.error(result.error);
      else if (result.success && result.purchase) {
        setPurchases((prev) => [result.purchase!, ...prev]);
        setIsOpen(false);
        toast.success("Compra en cuotas registrada");
      }
    });
  };

  const handlePayInstallment = (
    purchaseId: string,
    installment: SerializedCreditInstallment
  ) => {
    startTransition(async () => {
      const result = await payInstallmentAction(installment.id);
      if (result.error) toast.error(result.error);
      else {
        setPurchases((prev) =>
          prev.map((p) => {
            if (p.id !== purchaseId) return p;
            return {
              ...p,
              paidInstallments: p.paidInstallments + 1,
              installments: p.installments.map((i) =>
                i.id === installment.id
                  ? { ...i, isPaid: true, paidAt: new Date().toISOString() }
                  : i
              ),
            };
          })
        );
        toast.success(`Cuota ${installment.installmentNumber} pagada`);
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteCreditPurchaseAction(id);
      if (result.error) toast.error(result.error);
      else {
        setPurchases((prev) => prev.filter((p) => p.id !== id));
        toast.success("Compra eliminada");
      }
      setDeletingId(null);
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cuotas</h1>
          <p className="text-sm text-muted mt-0.5">
            {activePurchases.length} compra
            {activePurchases.length !== 1 ? "s" : ""} activa
            {activePurchases.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsOpen(true)}>
          <Plus size={16} className="mr-1.5" />
          Nueva
        </Button>
      </div>

      {/* This month */}
      {activePurchases.length > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Cuotas próximas a vencer</p>
          <p className="text-xl font-bold font-mono text-warning">
            {formatCurrency(totalMonthly, "ARS")}
          </p>
        </div>
      )}

      {/* Empty */}
      {purchases.length === 0 && (
        <EmptyState
          icon={CreditCard}
          title="Sin cuotas registradas"
          description="Registrá tus compras en cuotas para hacer seguimiento de los pagos."
          action={
            <Button onClick={() => setIsOpen(true)}>
              <Plus size={16} className="mr-1.5" />
              Nueva compra
            </Button>
          }
        />
      )}

      {/* Active purchases */}
      {activePurchases.map((p) => {
        const isExpanded = expanded.has(p.id);
        const nextUnpaid = p.installments.find((i) => !i.isPaid);
        const pct = Math.round(
          (p.paidInstallments / p.totalInstallments) * 100
        );

        return (
          <Card key={p.id} className="group">
            <CardContent className="p-4 space-y-3">
              {/* Purchase header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {p.description}
                  </p>
                  <p className="text-xs text-muted">
                    {p.accountName || "Sin cuenta"} ·{" "}
                    {formatCurrency(p.totalAmount, p.currency)}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                    {p.paidInstallments}/{p.totalInstallments}
                  </span>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id || isPending}
                    className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Next installment */}
              {nextUnpaid && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted">
                      Cuota {nextUnpaid.installmentNumber} · vence{" "}
                      {formatDate(nextUnpaid.dueDate)}
                    </p>
                    <p className="text-sm font-bold font-mono text-warning">
                      {formatCurrency(nextUnpaid.amount, p.currency)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toggleExpanded(p.id)}
                      className="h-7 px-2 text-xs"
                    >
                      {isExpanded ? "Ocultar" : "Ver cuotas"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handlePayInstallment(p.id, nextUnpaid)}
                      disabled={isPending}
                      className="h-7 px-2 text-xs"
                    >
                      <Check size={12} className="mr-1" />
                      Pagar
                    </Button>
                  </div>
                </div>
              )}

              {/* Installment list */}
              {isExpanded && (
                <div className="mt-1 border-t border-border pt-3 space-y-1.5">
                  {p.installments.map((inst) => (
                    <div
                      key={inst.id}
                      className={`flex items-center justify-between text-xs rounded-lg px-2 py-1.5 ${
                        inst.isPaid
                          ? "text-muted"
                          : "bg-surface-2 text-foreground"
                      }`}
                    >
                      <span>
                        Cuota {inst.installmentNumber} ·{" "}
                        {formatDate(inst.dueDate)}
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          inst.isPaid ? "line-through" : ""
                        }`}
                      >
                        {formatCurrency(inst.amount, p.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Completed */}
      {completedPurchases.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">
            Completadas ({completedPurchases.length})
          </p>
          {completedPurchases.map((p) => (
            <Card key={p.id} className="group opacity-60">
              <CardContent className="p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground line-through">
                    {p.description}
                  </p>
                  <p className="text-xs text-muted">
                    {formatCurrency(p.totalAmount, p.currency)} ·{" "}
                    {p.totalInstallments} cuotas
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deletingId === p.id || isPending}
                  className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent title="Nueva compra en cuotas">
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="credit-desc">Descripción *</Label>
              <Input
                id="credit-desc"
                name="description"
                placeholder="Ej: Smart TV 55'', Notebook..."
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="credit-account">Tarjeta de crédito *</Label>
              <Select
                id="credit-account"
                name="accountId"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Seleccionar tarjeta
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              {creditAccounts.length === 0 && (
                <p className="text-xs text-warning">
                  Tip: creá una cuenta de tipo "Tarjeta de crédito" primero
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="credit-amount">Monto total *</Label>
                <Input
                  id="credit-amount"
                  name="totalAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="credit-currency">Moneda</Label>
                <Select
                  id="credit-currency"
                  name="currency"
                  defaultValue="ARS"
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="credit-installments">Cuotas *</Label>
                <Input
                  id="credit-installments"
                  name="totalInstallments"
                  type="number"
                  min="1"
                  max="60"
                  defaultValue="12"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="credit-first">1ª cuota *</Label>
                <Input
                  id="credit-first"
                  name="firstPaymentDate"
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="credit-cat">Categoría</Label>
              <Select id="credit-cat" name="categoryId" defaultValue="">
                <option value="">Sin categoría</option>
                {categories
                  .filter((c) => c.type === "EXPENSE")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
              </Select>
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
                {isPending ? "Guardando..." : "Registrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
