"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Wallet, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { createAccountAction, updateAccountAction, deleteAccountAction } from "@/app/actions/accounts";
import type { SerializedAccount } from "@/lib/db/accounts";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  BANK: "Cuenta bancaria",
  DIGITAL_WALLET: "Billetera digital",
  CREDIT_CARD: "Tarjeta de crédito",
  SAVINGS: "Caja de ahorros",
  INVESTMENT: "Inversión",
  CRYPTO: "Criptomonedas",
  FOREIGN_CURRENCY: "Moneda extranjera",
};

const ACCOUNT_TYPE_ICONS: Record<string, string> = {
  CASH: "💵",
  BANK: "🏦",
  DIGITAL_WALLET: "📱",
  CREDIT_CARD: "💳",
  SAVINGS: "🏧",
  INVESTMENT: "📈",
  CRYPTO: "₿",
  FOREIGN_CURRENCY: "🌐",
};

interface Props {
  initialAccounts: SerializedAccount[];
}

export function CuentasClient({ initialAccounts }: Props) {
  const [accounts, setAccounts] = useState<SerializedAccount[]>(initialAccounts);
  const [isOpen, setIsOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SerializedAccount | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalARS = accounts
    .filter((a) => a.currency === "ARS")
    .reduce((acc, a) => acc + a.balance, 0);

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createAccountAction(formData);
      if (result.error) {
        toast.error(result.error);
      } else if (result.success && result.account) {
        setAccounts((prev) => [...prev, result.account!]);
        setIsOpen(false);
        toast.success("Cuenta creada");
      }
    });
  };

  const handleEdit = (formData: FormData) => {
    if (!editingAccount) return;
    startTransition(async () => {
      const result = await updateAccountAction(editingAccount.id, formData);
      if (result.error) {
        toast.error(result.error);
      } else if (result.success && result.account) {
        setAccounts((prev) => prev.map((a) => a.id === result.account!.id ? result.account! : a));
        setEditingAccount(null);
        toast.success("Cuenta actualizada");
      }
    });
  };

  const handleDelete = (accountId: string) => {
    setDeletingId(accountId);
    startTransition(async () => {
      const result = await deleteAccountAction(accountId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
        toast.success("Cuenta eliminada");
      }
      setDeletingId(null);
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cuentas</h1>
          <p className="text-sm text-muted mt-0.5">
            {accounts.length} cuenta{accounts.length !== 1 ? "s" : ""} •{" "}
            <span className="font-mono text-foreground">
              {formatCurrency(totalARS, "ARS")}
            </span>{" "}
            en pesos
          </p>
        </div>
        <Button onClick={() => setIsOpen(true)} size="sm">
          <Plus size={16} className="mr-1.5" />
          Nueva
        </Button>
      </div>

      {/* Account list */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sin cuentas aún"
          description="Agregá tu primera cuenta para empezar a registrar tus movimientos."
          action={
            <Button onClick={() => setIsOpen(true)}>
              <Plus size={16} className="mr-1.5" />
              Nueva cuenta
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <Card key={account.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{
                      backgroundColor: account.color
                        ? `${account.color}20`
                        : "var(--color-surface-2)",
                    }}
                  >
                    {account.icon ||
                      ACCOUNT_TYPE_ICONS[account.type] ||
                      "🏦"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {account.name}
                    </p>
                    <p className="text-xs text-muted">
                      {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                    </p>
                  </div>

                  {/* Balance */}
                  <div className="text-right flex-shrink-0">
                    <p
                      className={`text-base font-bold font-mono ${
                        account.balance >= 0
                          ? "text-foreground"
                          : "text-danger"
                      }`}
                    >
                      {formatCurrency(account.balance, account.currency)}
                    </p>
                    <p className="text-xs text-muted">{account.currency}</p>
                  </div>

                  {/* Edit */}
                  <button
                    onClick={() => setEditingAccount(account)}
                    disabled={isPending}
                    className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  >
                    <Pencil size={14} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(account.id)}
                    disabled={deletingId === account.id || isPending}
                    className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Account Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={(o) => !o && setEditingAccount(null)}>
        <DialogContent title="Editar cuenta">
          <form action={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre *</Label>
              <Input id="edit-name" name="name" defaultValue={editingAccount?.name} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-type">Tipo *</Label>
              <Select id="edit-type" name="type" defaultValue={editingAccount?.type} required>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {ACCOUNT_TYPE_ICONS[value]} {label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-currency">Moneda *</Label>
                <Select id="edit-currency" name="currency" defaultValue={editingAccount?.currency} required>
                  <option value="ARS">ARS — Peso</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="BRL">BRL — Real</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-balance">Saldo</Label>
                <Input
                  id="edit-balance"
                  name="balance"
                  type="number"
                  step="0.01"
                  defaultValue={editingAccount?.balance ?? 0}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-icon">Ícono (emoji)</Label>
                <Input id="edit-icon" name="icon" placeholder="🏦" maxLength={4} defaultValue={editingAccount?.icon ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-color">Color</Label>
                <div className="flex gap-2 items-center">
                  <Input id="edit-color" name="color" type="color" defaultValue={editingAccount?.color ?? "#38bdf8"} className="h-10 w-12 p-1 cursor-pointer" />
                  <span className="text-xs text-muted">Opcional</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setEditingAccount(null)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Account Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent title="Nueva cuenta">
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                name="name"
                placeholder="Ej: Galicia ARS, Efectivo, MP"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type">Tipo *</Label>
              <Select id="type" name="type" defaultValue="BANK" required>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {ACCOUNT_TYPE_ICONS[value]} {label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="currency">Moneda *</Label>
                <Select
                  id="currency"
                  name="currency"
                  defaultValue="ARS"
                  required
                >
                  <option value="ARS">ARS — Peso</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="BRL">BRL — Real</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="balance">Saldo inicial</Label>
                <Input
                  id="balance"
                  name="balance"
                  type="number"
                  step="0.01"
                  defaultValue="0"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="icon">Ícono (emoji)</Label>
                <Input
                  id="icon"
                  name="icon"
                  placeholder="🏦"
                  maxLength={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="color">Color</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="color"
                    name="color"
                    type="color"
                    defaultValue="#38bdf8"
                    className="h-10 w-12 p-1 cursor-pointer"
                  />
                  <span className="text-xs text-muted">Opcional</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Creando..." : "Crear cuenta"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
