"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { createTransactionAction } from "@/app/actions/transactions";
import type { SerializedAccount } from "@/lib/db/accounts";
import type { SerializedCategory } from "@/lib/db/categories";

type TxType = "INCOME" | "EXPENSE" | "TRANSFER";

interface Props {
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
}

export function DashboardQuickAdd({ accounts, categories }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [txType, setTxType] = useState<TxType>("EXPENSE");
  const [isPending, startTransition] = useTransition();

  const openModal = (type: TxType) => {
    setTxType(type);
    setIsOpen(true);
  };

  const filteredCategories = categories.filter((c) => c.type === txType);

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createTransactionAction(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        setIsOpen(false);
        const labels: Record<TxType, string> = {
          INCOME: "Ingreso registrado ✓",
          EXPENSE: "Gasto registrado ✓",
          TRANSFER: "Transferencia registrada ✓",
        };
        toast.success(labels[txType]);
      }
    });
  };

  return (
    <>
      {/* Quick add buttons */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="income"
            onClick={() => openModal("INCOME")}
            className="w-full"
          >
            <ArrowDownLeft size={15} />
            Nuevo ingreso
          </Button>
          <Button
            variant="expense"
            onClick={() => openModal("EXPENSE")}
            className="w-full"
          >
            <ArrowUpRight size={15} />
            Nuevo gasto
          </Button>
        </div>
        <button
          onClick={() => openModal("TRANSFER")}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors"
        >
          <ArrowLeftRight size={12} />
          Nueva transferencia
        </button>
      </div>

      {/* Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent title="Nuevo movimiento">
          {/* Type tabs */}
          <div className="flex rounded-xl overflow-hidden border border-border mb-5">
            {(["EXPENSE", "INCOME", "TRANSFER"] as TxType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTxType(t)}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                  txType === t
                    ? t === "EXPENSE"
                      ? "bg-danger text-white"
                      : t === "INCOME"
                      ? "bg-success text-white"
                      : "bg-primary text-background"
                    : "bg-surface text-muted hover:text-foreground"
                }`}
              >
                {t === "EXPENSE" ? "Gasto" : t === "INCOME" ? "Ingreso" : "Transferencia"}
              </button>
            ))}
          </div>

          <form action={handleCreate} className="space-y-4">
            <input type="hidden" name="type" value={txType} />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dqa-amount">Monto *</Label>
                <Input
                  id="dqa-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dqa-currency">Moneda</Label>
                <Select id="dqa-currency" name="currency" defaultValue="ARS">
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dqa-date">Fecha *</Label>
              <Input
                id="dqa-date"
                name="date"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dqa-description">Descripción</Label>
              <Input
                id="dqa-description"
                name="description"
                placeholder="Ej: Supermercado, sueldo..."
              />
            </div>

            {txType !== "TRANSFER" && (
              <div className="space-y-1.5">
                <Label htmlFor="dqa-category">Categoría</Label>
                <Select id="dqa-category" name="categoryId" defaultValue="">
                  <option value="">Sin categoría</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {txType !== "TRANSFER" ? (
              <div className="space-y-1.5">
                <Label htmlFor="dqa-account">Cuenta</Label>
                <Select id="dqa-account" name="accountId" defaultValue="">
                  <option value="">Sin cuenta</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dqa-from">Desde *</Label>
                  <Select id="dqa-from" name="accountId" defaultValue="">
                    <option value="">Seleccionar</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dqa-to">Hacia *</Label>
                  <Select id="dqa-to" name="toAccountId" defaultValue="">
                    <option value="">Seleccionar</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="dqa-notes">Notas</Label>
              <Textarea
                id="dqa-notes"
                name="notes"
                placeholder="Notas adicionales..."
                rows={2}
              />
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
              <Button
                type="submit"
                className="flex-1"
                disabled={isPending}
              >
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
