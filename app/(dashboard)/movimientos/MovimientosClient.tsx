"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Trash2,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import {
  createTransactionAction,
  deleteTransactionAction,
  getTransactionsAction,
} from "@/app/actions/transactions";
import type { SerializedTransaction } from "@/lib/db/transactions";
import type { SerializedAccount } from "@/lib/db/accounts";
import type { SerializedCategory } from "@/lib/db/categories";

type TxType = "INCOME" | "EXPENSE" | "TRANSFER";

const TYPE_CONFIG: Record<
  TxType,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  INCOME: {
    label: "Ingreso",
    icon: ArrowDownLeft,
    color: "text-success",
    bg: "bg-success/10",
  },
  EXPENSE: {
    label: "Gasto",
    icon: ArrowUpRight,
    color: "text-danger",
    bg: "bg-danger/10",
  },
  TRANSFER: {
    label: "Transferencia",
    icon: ArrowLeftRight,
    color: "text-primary",
    bg: "bg-primary/10",
  },
};

interface Props {
  initialTransactions: SerializedTransaction[];
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  initialMonth: number;
  initialYear: number;
}

export function MovimientosClient({
  initialTransactions,
  accounts,
  categories,
  initialMonth,
  initialYear,
}: Props) {
  const now = new Date();
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [transactions, setTransactions] =
    useState<SerializedTransaction[]>(initialTransactions);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterAccountId, setFilterAccountId] = useState<string>("ALL");
  const [isOpen, setIsOpen] = useState(false);
  const [txType, setTxType] = useState<TxType>("EXPENSE");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openModal = (type: TxType) => {
    setTxType(type);
    setIsOpen(true);
  };

  // Navigate months
  const navigate = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    setMonth(newMonth);
    setYear(newYear);
    startTransition(async () => {
      const data = await getTransactionsAction(newMonth, newYear);
      setTransactions(data);
    });
  };

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== "ALL" && tx.type !== filterType) return false;
      if (filterAccountId !== "ALL" && tx.accountId !== filterAccountId)
        return false;
      return true;
    });
  }, [transactions, filterType, filterAccountId]);

  // Summaries
  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((s, t) => s + t.amount, 0);

  // Categories for current txType
  const filteredCategories = categories.filter(
    (c) => c.type === txType
  );

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createTransactionAction(formData);
      if (result.error) {
        toast.error(result.error);
      } else if (result.success && result.transaction) {
        const tx = result.transaction;
        const txDate = new Date(tx.date);
        const txMonth = txDate.getMonth() + 1;
        const txYear = txDate.getFullYear();
        // Only add to list if it falls in the currently viewed month
        if (txMonth === month && txYear === year) {
          setTransactions((prev) =>
            [tx, ...prev].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
          );
        }
        setIsOpen(false);
        toast.success(
          `${TYPE_CONFIG[tx.type as TxType]?.label ?? "Movimiento"} registrado`
        );
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteTransactionAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        toast.success("Movimiento eliminado");
      }
      setDeletingId(null);
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-foreground">Movimientos</h1>

        {/* Primary action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="success"
            onClick={() => openModal("INCOME")}
            className="w-full"
          >
            <ArrowDownLeft size={16} className="mr-1.5" />
            Nuevo ingreso
          </Button>
          <Button
            variant="danger"
            onClick={() => openModal("EXPENSE")}
            className="w-full"
          >
            <ArrowUpRight size={16} className="mr-1.5" />
            Nuevo gasto
          </Button>
        </div>

        {/* Secondary: transfer */}
        <button
          onClick={() => openModal("TRANSFER")}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors"
        >
          <ArrowLeftRight size={12} />
          Nueva transferencia
        </button>
      </div>

      {/* Month navigation + summary */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          disabled={isPending}
          className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-foreground capitalize">
          {formatMonth(month, year)}
        </span>
        <button
          onClick={() => navigate(1)}
          disabled={
            isPending ||
            (month === now.getMonth() + 1 && year === now.getFullYear())
          }
          className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Mini summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-success/10 rounded-xl p-3">
          <p className="text-xs text-muted mb-0.5">Ingresos</p>
          <p className="text-base font-bold font-mono text-success">
            {formatCurrency(totalIncome, "ARS")}
          </p>
        </div>
        <div className="bg-danger/10 rounded-xl p-3">
          <p className="text-xs text-muted mb-0.5">Gastos</p>
          <p className="text-base font-bold font-mono text-danger">
            {formatCurrency(totalExpense, "ARS")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["ALL", "INCOME", "EXPENSE", "TRANSFER"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterType === t
                ? "bg-primary text-background"
                : "bg-surface-2 text-muted hover:text-foreground"
            }`}
          >
            {t === "ALL"
              ? "Todos"
              : t === "INCOME"
              ? "Ingresos"
              : t === "EXPENSE"
              ? "Gastos"
              : "Transferencias"}
          </button>
        ))}
        {accounts.length > 0 && (
          <select
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
            className="px-3 py-1 rounded-full text-xs font-medium bg-surface-2 text-muted border-none outline-none cursor-pointer"
          >
            <option value="ALL">Todas las cuentas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin movimientos"
          description={
            filterType === "ALL" && filterAccountId === "ALL"
              ? "Registrá ingresos, gastos o transferencias para este mes."
              : "No hay movimientos con los filtros seleccionados."
          }
          action={
            filterType === "ALL" && filterAccountId === "ALL" ? (
              <div className="flex gap-2">
                <Button variant="success" onClick={() => openModal("INCOME")}>
                  <ArrowDownLeft size={16} className="mr-1.5" />
                  Ingreso
                </Button>
                <Button variant="danger" onClick={() => openModal("EXPENSE")}>
                  <ArrowUpRight size={16} className="mr-1.5" />
                  Gasto
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => {
            const cfg = TYPE_CONFIG[tx.type as TxType];
            const Icon = cfg?.icon ?? Receipt;
            const isExpense = tx.type === "EXPENSE";
            const isTransfer = tx.type === "TRANSFER";
            return (
              <Card key={tx.id} className="group">
                <CardContent className="p-3.5">
                  <div className="flex items-center gap-3">
                    {/* Type icon */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg?.bg ?? "bg-surface-2"}`}
                    >
                      {tx.categoryIcon ? (
                        <span className="text-base">{tx.categoryIcon}</span>
                      ) : (
                        <Icon size={15} className={cfg?.color ?? "text-muted"} />
                      )}
                    </div>

                    {/* Description + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {tx.description || tx.categoryName || cfg?.label}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {formatDate(tx.date)}
                        {tx.accountName && ` · ${tx.accountName}`}
                        {isTransfer &&
                          tx.toAccountName &&
                          ` → ${tx.toAccountName}`}
                        {tx.categoryName && !tx.description && ""}
                        {tx.description && tx.categoryName
                          ? ` · ${tx.categoryName}`
                          : ""}
                      </p>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-sm font-bold font-mono ${
                          isExpense
                            ? "text-danger"
                            : isTransfer
                            ? "text-primary"
                            : "text-success"
                        }`}
                      >
                        {isExpense ? "−" : isTransfer ? "" : "+"}
                        {formatCurrency(tx.amount, tx.currency)}
                      </p>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id || isPending}
                      className="ml-1 p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Transaction Dialog */}
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
                {t === "EXPENSE"
                  ? "Gasto"
                  : t === "INCOME"
                  ? "Ingreso"
                  : "Transferencia"}
              </button>
            ))}
          </div>

          <form action={handleCreate} className="space-y-4">
            <input type="hidden" name="type" value={txType} />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Monto *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">Moneda</Label>
                <Select
                  id="currency"
                  name="currency"
                  defaultValue="ARS"
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date">Fecha *</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                name="description"
                placeholder="Ej: Almuerzo con clientes"
              />
            </div>

            {txType !== "TRANSFER" && (
              <div className="space-y-1.5">
                <Label htmlFor="categoryId">Categoría</Label>
                <Select id="categoryId" name="categoryId" defaultValue="">
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
                <Label htmlFor="accountId">Cuenta</Label>
                <Select id="accountId" name="accountId" defaultValue="">
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
                  <Label htmlFor="accountId">Desde</Label>
                  <Select id="accountId" name="accountId" defaultValue="">
                    <option value="">Seleccionar</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="toAccountId">Hacia</Label>
                  <Select
                    id="toAccountId"
                    name="toAccountId"
                    defaultValue=""
                  >
                    <option value="">Seleccionar</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
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
